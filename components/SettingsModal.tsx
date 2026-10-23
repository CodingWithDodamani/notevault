'use client';

import React from 'react';
import {
  Settings,
  Shield,
  Download,
  Trash2,
  HardDrive,
  Moon,
  Sun,
  RotateCcw,
  Check,
  Monitor,
} from 'lucide-react';
import { DriveSyncInfo } from '@/lib/vault-store';
import { VaultFile } from '@/lib/types';
import { useToast } from '@/lib/use-toast';
import { Dialog } from '@/components/Dialog';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncInfo: DriveSyncInfo;
  files: VaultFile[];
  isDarkMode: boolean;
  themePreference?: ThemePreference;
  setThemePreference?: (pref: ThemePreference) => void;
  setIsDarkMode: (val: boolean) => void;
  onResetVault: () => void;
  onOpenSync: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  syncInfo,
  files,
  isDarkMode,
  themePreference = isDarkMode ? 'dark' : 'light',
  setThemePreference,
  setIsDarkMode,
  onResetVault,
  onOpenSync,
}: SettingsModalProps) {
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSelectTheme = (pref: ThemePreference) => {
    if (setThemePreference) {
      setThemePreference(pref);
    } else {
      setIsDarkMode(pref === 'dark');
    }
  };

  const handleExportJson = () => {
    const exportData = {
      appName: 'NoteVault Cloud',
      exportedAt: new Date().toISOString(),
      filesCount: files.length,
      filesMetadata: files.map((f) => ({
        id: f.id,
        name: f.name,
        extension: f.extension,
        sizeBytes: f.sizeBytes,
        category: f.category,
        subject: f.subject,
        topic: f.topic,
        exam: f.exam,
        year: f.year,
        tags: f.tags,
        description: f.description,
        isFavorite: f.isFavorite,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notevault_metadata_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Metadata exported', description: `${files.length} files saved to backup JSON.` });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Settings & Privacy">

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Appearance Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                Appearance & Theme
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Active: {isDarkMode ? 'Dark Slate' : 'Light Monochrome'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectTheme('light')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-all justify-center ${
                  themePreference === 'light'
                    ? 'border-zinc-900 dark:border-zinc-100 font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-all justify-center ${
                  themePreference === 'dark'
                    ? 'border-zinc-900 dark:border-zinc-100 font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectTheme('system')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-all justify-center ${
                  themePreference === 'system'
                    ? 'border-zinc-900 dark:border-zinc-100 font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* Connected Google Drive Section */}
          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                Google Drive Storage
              </span>
              <button
                onClick={onOpenSync}
                className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:underline"
              >
                Manage Connection
              </button>
            </div>
            <p className="text-zinc-500">
              Account: {syncInfo.userEmail ? syncInfo.userEmail : 'Not Connected'}
            </p>
            <p className="text-zinc-500">
              Notes Scope: {syncInfo.rootFolderName ? syncInfo.rootFolderName : 'Entire Google Drive'}
            </p>
          </div>

          {/* Privacy & No Lock-in Policy */}
          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-start gap-3">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                Zero Lock-In & Privacy Guarantee
              </span>
              <p className="text-zinc-500 leading-relaxed text-[11px]">
                Your original files remain 100% in Google Drive. This website never stores your 96 GB documents in an app database. If NoteVault is disconnected, all your files remain untouched in Google Drive.
              </p>
            </div>
          </div>

          {/* Data Backup & Reset */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
              Data Management & Metadata Backup
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleExportJson}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors flex-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Metadata (.json)</span>
              </button>
              <button
                onClick={() => {
                  onResetVault();
                  toast({
                    title: 'Vault cleared',
                    description: 'All local notes and metadata removed. Re-sync from Drive to restore.',
                  });
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Local Index</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Done
          </button>
        </div>
      </Dialog>
  );
}
