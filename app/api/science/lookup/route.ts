import { NextRequest, NextResponse } from 'next/server';
import { authenticate, checkQuota, quotaHeaders } from '@/lib/server-auth';

const QUOTA_LIMIT = 120; // public upstream APIs, but still an amplification proxy

async function fetchJsonSafely(
  url: string,
  options: RequestInit = {},
  maxRetries = 1,
  baseDelayMs = 300
): Promise<any | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      }

      // 404 is expected when querying a protein name against a small-molecule chemical DB
      if (response.status === 404 || response.status === 400) {
        return null;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return null;
    } catch {
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  const type = searchParams.get('type') || 'all'; // 'uniprot' | 'pubchem' | 'pubmed' | 'all'

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required.' }, { status: 400 });
  }

  const authResult = await authenticate(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const quota = checkQuota(authResult.user.uid, QUOTA_LIMIT);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. You can run ${quota.limit} science lookups per hour.` },
      { status: 429, headers: quotaHeaders(quota) }
    );
  }

  const results: {
    query: string;
    timestamp: string;
    records: any[];
  } = {
    query,
    timestamp: new Date().toISOString(),
    records: [],
  };

  const tasks: Promise<void>[] = [];

  // 1. UniProt Protein Lookup (proteins, enzymes, genes)
  if (type === 'all' || type === 'uniprot') {
    tasks.push(
      (async () => {
        const uniprotUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(
          query
        )}&size=2&fields=accession,id,protein_name,gene_names,organism_name,length,cc_function`;
        const data = await fetchJsonSafely(uniprotUrl, {
          headers: { Accept: 'application/json' },
        });
        if (data?.results && Array.isArray(data.results)) {
          data.results.forEach((item: any) => {
            const proteinName =
              item.proteinDescription?.recommendedName?.fullName?.value ||
              item.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
              item.primaryAccession;
            const organism = item.organism?.scientificName || 'Homo sapiens';
            const functionDesc =
              item.comments?.find((c: any) => c.commentType === 'FUNCTION')?.texts?.[0]?.value ||
              'Essential biological functional element.';

            results.records.push({
              source: 'UniProtKB',
              provenance: 'Curated protein database',
              identifier: item.primaryAccession,
              title: proteinName,
              subtext: `${organism} · Length: ${item.sequence?.length || '?'} aa`,
              summary: functionDesc.slice(0, 240) + (functionDesc.length > 240 ? '...' : ''),
              url: `https://www.uniprot.org/uniprotkb/${item.primaryAccession}/entry`,
            });
          });
        }
      })()
    );
  }

  // 2. PubChem Compound Lookup using lightweight Property Table endpoint
  if (type === 'all' || type === 'pubchem') {
    tasks.push(
      (async () => {
        const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
          query
        )}/property/MolecularFormula,MolecularWeight,IUPACName,Title/JSON`;
        const data = await fetchJsonSafely(pubchemUrl, {
          headers: { Accept: 'application/json' },
        });
        const prop = data?.PropertyTable?.Properties?.[0];
        if (prop && prop.CID) {
          results.records.push({
            source: 'PubChem',
            provenance: 'Experimentally determined chemical entity',
            identifier: `CID ${prop.CID}`,
            title: prop.Title || prop.IUPACName || query,
            subtext: `Formula: ${prop.MolecularFormula || 'N/A'} · Mass: ${prop.MolecularWeight || 'N/A'} g/mol`,
            summary: prop.IUPACName
              ? `Preferred IUPAC: ${prop.IUPACName}. Validated chemical structure and properties record.`
              : `PubChem chemical structure and properties record for ${query}.`,
            url: `https://pubchem.ncbi.nlm.nih.gov/compound/${prop.CID}`,
          });
        }
      })()
    );
  }

  // 3. PubMed Biomedical Literature
  if (type === 'all' || type === 'pubmed') {
    tasks.push(
      (async () => {
        const pubmedSearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
          query
        )}&retmode=json&retmax=2`;
        const data = await fetchJsonSafely(pubmedSearchUrl);
        const idList: string[] = data?.esearchresult?.idlist || [];

        if (idList.length > 0) {
          const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(
            ','
          )}&retmode=json`;
          const sumData = await fetchJsonSafely(summaryUrl);

          idList.forEach((pmid) => {
            const doc = sumData?.result?.[pmid];
            if (doc) {
              const authorsList = (doc.authors || [])
                .map((a: any) => a.name)
                .slice(0, 3)
                .join(', ');
              results.records.push({
                source: 'PubMed',
                provenance: 'Peer-reviewed biomedical literature',
                identifier: `PMID: ${pmid}`,
                title: doc.title || `Study on ${query}`,
                subtext: `${doc.source || 'Medical Journal'} · ${doc.pubdate || 'Recent'}`,
                summary: authorsList ? `Authors: ${authorsList} et al.` : 'Indexed biomedical study.',
                url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
              });
            }
          });
        }
      })()
    );
  }

  await Promise.allSettled(tasks);

  return NextResponse.json(results, { headers: quotaHeaders(quota) });
}

