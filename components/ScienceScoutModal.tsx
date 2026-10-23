'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Dna,
  ExternalLink,
  FlaskConical,
} from 'lucide-react';
import { apiFetch, readApiError } from '@/lib/api-client';
import { useToast } from '@/lib/use-toast';
import { Dialog } from '@/components/Dialog';

interface ScienceRecord {
  source: string;
  provenance: string;
  identifier: string;
  title: string;
  subtext: string;
  summary: string;
  url: string;
}

interface ScienceScoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const EXAMPLE_TARGETS = [
  'Hemoglobin',
  'Insulin',
  'DNA Polymerase',
  'Aspirin',
  'Adenosine Triphosphate',
  'Michaelis-Menten',
];

export function ScienceScoutModal({
  isOpen,
  onClose,
  initialQuery = 'Hemoglobin',
}: ScienceScoutModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [records, setRecords] = useState<ScienceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Single fetch path for both the initial target and manual searches.
  // The parent keys this component on `isOpen` so it remounts with the initial
  // query each time it is opened, which avoids syncing state from a prop.
  useEffect(() => {
    if (!isOpen) return;
    const term = activeQuery.trim();
    if (!term) return;

    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`/api/science/lookup?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, 'Failed to fetch scientific records.'));
        }
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setRecords(data.records || []);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Science lookup failed:', err);
        toast({
          title: 'Search failed',
          description:
            err instanceof Error ? err.message : 'Failed to fetch scientific reference records.',
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [isOpen, activeQuery, toast]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setActiveQuery(term);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Science Scout">
      <div className="p-6 space-y-5 text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Dna className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Science Scout
              </h3>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">
                UniProt · PubChem · PubMed
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Authoritative reference lookup for biology, chemistry, and exam science notes.
            </p>
          </div>
        </div>

        {/* Search bar & Example Target Chips */}
        <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 space-y-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search biological protein, chemical compound, or gene..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Searching...' : 'Explore'}
            </button>
          </form>

          {/* Quick example buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-zinc-400 text-[11px] shrink-0">Try targets:</span>
            {EXAMPLE_TARGETS.map((target) => (
              <button
                key={target}
                onClick={() => {
                  setQuery(target);
                  setActiveQuery(target);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors whitespace-nowrap shrink-0 ${
                  activeQuery.toLowerCase() === target.toLowerCase()
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-medium'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {target}
              </button>
            ))}
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-zinc-500 space-y-2">
              <FlaskConical className="w-6 h-6 mx-auto animate-pulse text-zinc-400" />
              <p>Querying authoritative UniProt, PubChem & PubMed scientific registries...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-500 space-y-2">
              <p>No direct scientific accession found for &ldquo;{activeQuery}&rdquo;.</p>
              <p className="text-zinc-400">
                Try searching standard biological terms like Hemoglobin, Insulin, DNA Polymerase, or ATP.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {/* Zero-Pill Unboxed Provenance & Source */}
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-1">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {rec.source}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-zinc-500">{rec.identifier}</span>
                        <span>·</span>
                        <span className="text-zinc-400 italic">[{rec.provenance}]</span>
                      </div>

                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {rec.title}
                      </h4>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{rec.subtext}</p>
                    </div>

                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
                      title="Open authoritative database entry"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <p className="mt-2.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {rec.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
