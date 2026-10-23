import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { authenticate, checkQuota, quotaHeaders } from '@/lib/server-auth';

const MAX_FILENAME_CHARS = 512;
const QUOTA_LIMIT = 120; // classification is cheap; allow more of it

export async function POST(req: NextRequest) {
  try {
    const { fileName, currentPath } = await req.json();

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName is required.' }, { status: 400 });
    }

    if (fileName.length > MAX_FILENAME_CHARS) {
      return NextResponse.json(
        { error: `fileName is too long (max ${MAX_FILENAME_CHARS} characters).` },
        { status: 400 }
      );
    }

    const authResult = await authenticate(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    const quota = checkQuota(authResult.user.uid, QUOTA_LIMIT);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `Rate limit reached. You can run ${quota.limit} classifications per hour.` },
        { status: 429, headers: quotaHeaders(quota) }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server configuration error: GEMINI_API_KEY is missing.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // gemini-3.1-flash-lite for instantaneous classification
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Analyze this study note file name and path to classify its academic metadata:
File Name: "${fileName.replace(/["\\]/g, ' ')}"
Folder Path: "${typeof currentPath === 'string' ? currentPath.replace(/["\\]/g, ' ').slice(0, 256) : 'Root'}"

Infer the most accurate exam, academic subject, specific topic, year (if detectable), 3-5 lowercase tags starting with #, document category (e.g., 'Exam Notes', 'Question Bank', 'Formula Sheet', 'Handwritten Notes', 'Textbook'), and a 1-sentence description.
Return 0 for year if it cannot be detected.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            subject: { type: Type.STRING },
            topic: { type: Type.STRING },
            exam: { type: Type.STRING },
            year: { type: Type.INTEGER, description: '4-digit year or 0 if unknown' },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            description: { type: Type.STRING },
          },
          required: ['category', 'subject', 'topic', 'exam', 'tags', 'description'],
        },
      },
    });

    const jsonStr = response.text?.trim() || '{}';
    const parsed = JSON.parse(jsonStr);

    // Normalise the model output so the client can trust the shape.
    const year = Number(parsed?.year);
    const tags = Array.isArray(parsed?.tags)
      ? parsed.tags
          .filter((t: unknown): t is string => typeof t === 'string')
          .map((t: string) => t.trim().toLowerCase().slice(0, 40))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return NextResponse.json(
      {
        success: true,
        data: {
          category: String(parsed?.category ?? 'Study Notes').slice(0, 64),
          subject: String(parsed?.subject ?? 'General Study').slice(0, 64),
          topic: String(parsed?.topic ?? 'General').slice(0, 96),
          exam: String(parsed?.exam ?? 'General').slice(0, 64),
          year: Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : 0,
          tags,
          description: String(parsed?.description ?? '').slice(0, 500),
        },
      },
      { headers: quotaHeaders(quota) }
    );
  } catch (error: any) {
    console.error('Classification error:', error);
    return NextResponse.json(
      { error: 'Failed to classify file.' },
      { status: 500 }
    );
  }
}
