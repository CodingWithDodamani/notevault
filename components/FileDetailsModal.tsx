'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Save,
  ExternalLink,
  Star,
  Check,
  AlertCircle,
} from 'lucide-react';
import { VaultFile } from '@/lib/types';
import { formatBytes } from '@/lib/vault-store';
import { apiFetch, readApiError } from '@/lib/api-client';

interface FileDetailsModalProps {
  file: VaultFile | null;
  onClose: () => void;
  onSave: (fileId: string, updates: Partial<VaultFile>) => void;
  onToggleFavorite: (id: string) => void;
}

export function FileDetailsModal({
  file,
  onClose,
  onSave,
  onToggleFavorite,
}: FileDetailsModalProps) {
  const [category, setCategory] = useState(file?.category || 'Exam Notes');
  const [subject, setSubject] = useState(file?.subject || '');
  const [topic, setTopic] = useState(file?.topic || '');
  const [exam, setExam] = useState(file?.exam || '');
  const [year, setYear] = useState<number | string>(file?.year || '');
  const [tagsInput, setTagsInput] = useState(file?.tags?.join(' ') || '');
  const [description, setDescription] = useState(file?.description || '');
  const [isInferring, setIsInferring] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  if (!file) return null;

  const handleAiSuggest = async () => {
    setIsInferring(true);
    setInferError(null);
    try {
      const res = await apiFetch('/api/gemini/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          currentPath: file.folderPath,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, 'AI classification failed.'));
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error('AI classification returned no metadata.');
      }

      // The server normalises the model output, but validate again on the
      // client so a malformed value can never reach the persisted index.
      const d = data.data as Record<string, unknown>;
      if (typeof d.category === 'string' && d.category) setCategory(d.category.slice(0, 64));
      if (typeof d.subject === 'string' && d.subject) setSubject(d.subject.slice(0, 64));
      if (typeof d.topic === 'string' && d.topic) setTopic(d.topic.slice(0, 96));
      if (typeof d.exam === 'string' && d.exam) setExam(d.exam.slice(0, 64));

      const parsedYear = Number(d.year);
      if (Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100) {
        setYear(parsedYear);
      }

      if (Array.isArray(d.tags)) {
        const tags = d.tags
          .filter((t: unknown): t is string => typeof t === 'string')
          .map((t: string) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12);
        if (tags.length) setTagsInput(tags.join(' '));
      }

      if (typeof d.description === 'string' && d.description) {
        setDescription(d.description.slice(0, 500));
      }
    } catch (err: unknown) {
      console.error('AI suggestion error:', err);
      setInferError(
        err instanceof Error ? err.message : 'AI classification failed. Please try again.'
      );
    } finally {
      setIsInferring(false);
    }
  };

  const handleSave = () => {
    const parsedTags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .slice(0, 20);

    const parsedYear = year ? parseInt(String(year), 10) : NaN;

    onSave(file.id, {
      category: category.slice(0, 64),
      subject: subject.slice(0, 64),
      topic: topic.slice(0, 96),
      exam: exam.slice(0, 64),
      year: Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100
        ? parsedYear
        : null,
      tags: parsedTags,
      description: description.slice(0, 500),
    });
    setIsSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 shrink-0">
          <div className="min-w-0 flex-1 pr-4">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
              <span>{formatBytes(file.sizeBytes)}</span>
              <span>·</span>
              <span className="font-mono uppercase">{file.extension}</span>
              <span>·</span>
              <span>{file.folderPath}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onToggleFavorite(file.id)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-amber-500 transition-colors"
              title="Toggle Favorite"
            >
              <Star
                className={`w-4 h-4 ${
                  file.isFavorite ? 'fill-amber-400 text-amber-500' : ''
                }`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* AI Metadata Auto-inference bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80">
            <div className="space-y-0.5">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                Smart Auto-Metadata
              </span>
              <p className="text-zinc-500">
                Automatically infer exam, subject, topic, and tags using Gemini.
              </p>
            </div>
            <button
              onClick={handleAiSuggest}
              disabled={isInferring}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isInferring ? 'Analyzing...' : 'Auto-Suggest'}</span>
            </button>
          </div>

          {inferError && (
            <div
              role="alert"
              className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{inferError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1" htmlFor="fd-subject">
                Subject
              </label>
              <input
                id="fd-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics, Reasoning, General Science"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1" htmlFor="fd-exam">
                Exam Target
              </label>
              <input
                id="fd-exam"
                type="text"
                value={exam}
                onChange={(e) => setExam(e.target.value)}
                placeholder="e.g. RRB NTPC, SSC CGL, UPSC, Banking"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1" htmlFor="fd-topic">
                Specific Topic
              </label>
              <input
                id="fd-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Percentage, Seating Arrangement, Cell Biology"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1" htmlFor="fd-category">
                Category
              </label>
              <select
                id="fd-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              >
                <option value="Exam Notes">Exam Notes</option>
                <option value="Question Bank">Question Bank / PYQ</option>
                <option value="Formula Sheet">Formula Sheet</option>
                <option value="Handwritten Notes">Handwritten Notes</option>
                <option value="Textbook & Revision">Textbook & Revision</option>
                <option value="Reference">Reference</option>
                <option value="Study Planning">Study Planning</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1" htmlFor="fd-year">
                Exam Year
              </label>
              <input
                id="fd-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2025"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1" htmlFor="fd-tags">
                Tags (space separated)
              </label>
              <input
                id="fd-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="#maths #pyq #shortcuts"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1" htmlFor="fd-description">
              Description & Key Formula Reminders
            </label>
            <textarea
              id="fd-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key notes, shortcut formulas, or revision reminders..."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 leading-relaxed"
            />
          </div>

          {/* Read-only technical metadata */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] text-zinc-500 font-mono">
            <div>
              <span className="text-zinc-400 block font-sans">Drive File ID</span>
              <span className="truncate block">{file.id}</span>
            </div>
            <div>
              <span className="text-zinc-400 block font-sans">Created</span>
              <span>{new Date(file.createdTime).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-zinc-400 block font-sans">Last Modified</span>
              <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {file.webViewLink && (
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Drive</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaved ? 'Saved!' : 'Save Metadata'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
