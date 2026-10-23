'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  titleId?: string;
  children: React.ReactNode;
  'aria-describedby'?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  titleId,
  children,
  'aria-describedby': ariaDescribedby,
  closeOnEscape = true,
  closeOnBackdropClick = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      trapFocus(e);
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus.current && document.body.contains(previousFocus.current)) {
        previousFocus.current.focus();
      }
    };
  }, [isOpen, onClose, closeOnEscape, trapFocus]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose, closeOnBackdropClick]
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
        onClick={handleBackdropClick}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={ariaDescribedby}
          tabIndex={-1}
          className="w-full max-w-2xl sm:max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
              <h2 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
        </div>
      </div>
    </>
  );
}
