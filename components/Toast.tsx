'use client';

import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import { useToast, useToastAutoDismiss } from '@/lib/use-toast';
import type { Toast } from '@/lib/use-toast';

export function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast();
  const id = toast.id;

  useToastAutoDismiss(id, toast.duration);

  const handleDismiss = useCallback(() => dismiss(id), [dismiss, id]);

  return (
    <div className="pointer-events-auto flex w-full max-w-xs flex-col gap-1 p-4 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg ring-1 ring-black ring-opacity-5"
         role="alert"
         aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          {toast.title && (
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              {toast.title}
            </h3>
          )}
          {toast.description && (
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {toast.description}
            </p>
          )}
        </div>
        {toast.action && <div className="ml-auto">{toast.action}</div>}
        <button
          onClick={handleDismiss}
          className="ml-4 flex h-6 w-6 shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Dismiss toast"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Toast() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="relative">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
