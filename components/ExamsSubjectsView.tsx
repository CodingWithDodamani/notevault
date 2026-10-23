'use client';

import React, { useState } from 'react';
import {
  Compass,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Folder,
} from 'lucide-react';
import { VaultFile } from '@/lib/types';
import { formatBytes } from '@/lib/vault-store';

interface ExamsSubjectsViewProps {
  files: VaultFile[];
  onSelectExam: (exam: string) => void;
  onSelectSubject: (subject: string) => void;
  onOpenFile: (file: VaultFile) => void;
}

export function ExamsSubjectsView({
  files,
  onSelectExam,
  onSelectSubject,
  onOpenFile,
}: ExamsSubjectsViewProps) {
  const [activeTab, setActiveTab] = useState<'exams' | 'subjects'>('exams');

  // Group files by exam
  const examGroups = React.useMemo(() => {
    const map = new Map<string, VaultFile[]>();
    files.forEach((f) => {
      const examName = f.exam || 'General Study';
      if (!map.has(examName)) map.set(examName, []);
      map.get(examName)!.push(f);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [files]);

  // Group files by subject
  const subjectGroups = React.useMemo(() => {
    const map = new Map<string, VaultFile[]>();
    files.forEach((f) => {
      const subName = f.subject || 'General Notes';
      if (!map.has(subName)) map.set(subName, []);
      map.get(subName)!.push(f);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [files]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Exams & Subjects Taxonomy
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Organize your 96 GB Google Drive study library by syllabus syllabus requirements.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'exams'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            By Competitive Exam
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'subjects'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            By Academic Subject
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
          <GraduationCap className="w-10 h-10 mx-auto text-zinc-400" />
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              No Exams or Subjects Indexed Yet
            </h3>
            <p className="text-xs text-zinc-500">
              Sync your Google Drive library to automatically organize your documents into exam tracks and academic subject categories.
            </p>
          </div>
        </div>
      ) : activeTab === 'exams' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {examGroups.map(([examName, docList]) => {
            const totalBytes = docList.reduce((acc, f) => acc + f.sizeBytes, 0);
            return (
              <div
                key={examName}
                className="p-5 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {examName}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {docList.length} files · {formatBytes(totalBytes)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectExam(examName)}
                    className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300 hover:underline"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Top 3 notes under this exam */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {docList.slice(0, 3).map((f) => (
                    <div
                      key={f.id}
                      onClick={() => onOpenFile(f)}
                      className="cursor-pointer flex items-center justify-between p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                          {f.name}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {f.subject} · {f.topic}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-400 uppercase shrink-0">
                        {f.extension}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjectGroups.map(([subName, docList]) => {
            const totalBytes = docList.reduce((acc, f) => acc + f.sizeBytes, 0);
            return (
              <div
                key={subName}
                className="p-5 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {subName}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {docList.length} files · {formatBytes(totalBytes)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectSubject(subName)}
                    className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300 hover:underline"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Top 3 notes under this subject */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {docList.slice(0, 3).map((f) => (
                    <div
                      key={f.id}
                      onClick={() => onOpenFile(f)}
                      className="cursor-pointer flex items-center justify-between p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                          {f.name}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {f.exam} · {f.topic}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-400 uppercase shrink-0">
                        {f.extension}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
