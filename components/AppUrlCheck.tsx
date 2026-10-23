'use client';

import React from 'react';

/**
 * AppUrlCheck warns when APP_URL (NEXT_PUBLIC_APP_URL) is not configured on a
 * non-localhost origin. Without it, Google OAuth callbacks and self-referential
 * links won't work correctly on Vercel / Netlify.
 */

export function AppUrlCheck() {
  if (typeof window === 'undefined') return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const currentOrigin = window.location.origin;

  // Skip on localhost (expected during development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return null;
  }

  // Skip if APP_URL matches current origin
  if (appUrl && appUrl.replace(/\/$/, '') === currentOrigin.replace(/\/$/, '')) {
    return null;
  }

  return (
    <div
      className="fixed top-4 left-4 z-50 flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 max-w-md shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center text-amber-600 dark:text-amber-400">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 2L3 7m7 13l7-7m-7 7l-7-7" />
        </svg>
      </div>
      <div className="flex flex-col gap-2 text-sm leading-relaxed">
        <div className="font-semibold">APP_URL not configured</div>
        <div className="text-xs text-amber-700 dark:text-amber-300">
          Set <code className="font-mono">NEXT_PUBLIC_APP_URL</code> to your deployed URL
          (e.g. <code className="font-mono">https://notevault.vercel.app</code>) so Google OAuth
          callbacks and self-referential links work correctly.
          <br />
          <br />
          Add it in your platform&#39;s Environment Variables, then redeploy.
        </div>
      </div>
    </div>
  );
}
