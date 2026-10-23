'use client';

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';

/**
 * Setup-check banner.
 *
 * Detects the current origin and shows actionable Firebase / Google Cloud
 * Console setup steps so users don't hit opaque errors like
 * `auth/unauthorized-domain` when they deploy to Vercel or Netlify.
 * Dismissible per session.
 */

interface ConfigCheckProps {
  /** Override detected origin (useful for testing). */
  originOverride?: string;
}

const DISMISS_KEY = 'notevault:config-check-dismissed';

export function ConfigCheck({ originOverride }: ConfigCheckProps = {}) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true);
      if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const hostname =
    typeof window !== 'undefined'
      ? originOverride || window.location.hostname
      : originOverride || 'localhost';
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  // Skip on localhost — Firebase auto-authorizes localhost for development
  if (isLocal) return null;

  const isVercel = hostname.includes('vercel.app');
  const isNetlify = hostname.includes('netlify.app');
  const platform = isVercel ? 'Vercel' : isNetlify ? 'Netlify' : 'custom';

  const consoleHost =
    typeof window !== 'undefined' ? window.location.host : hostname;
  const origin =
    typeof window !== 'undefined' ? window.location.origin : `https://${consoleHost}`;

  const platformSetupLinks = isVercel
    ? [
        {
          name: 'Vercel Project Settings → Domains',
          url: 'https://vercel.com/dashboard',
          hint: 'Confirm your custom domain (e.g. app.vercel.app) is added.',
        },
      ]
    : isNetlify
      ? [
          {
            name: 'Netlify Site Settings → Domain management',
            url: 'https://app.netlify.com/',
            hint: 'Confirm your custom domain is added.',
          },
        ]
      : [];

  if (dismissed || !mounted) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 max-w-md shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="flex flex-col gap-2 text-sm leading-relaxed">
        <div className="font-semibold">Setup needed — Google sign-in</div>
        <div className="text-xs text-amber-700 dark:text-amber-300">
          Firebase sign-in is blocked because this origin is not authorized.
          <br />
          <br />
          <strong>Detected origin:</strong>
          <code className="font-mono ml-1">{origin}</code>
          <br />
          <br />
          <strong>1. Firebase Console</strong> → Authentication → Settings → Authorized domains:
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
            <li>
              Add <code className="font-mono">{consoleHost}</code>
            </li>
          </ul>
          {platformSetupLinks.length > 0 && (
            <>
              <strong>Hosting ({platform}):</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                {platformSetupLinks.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      {link.name}
                    </a>{' '}
                    {link.hint}
                  </li>
                ))}
              </ul>
            </>
          )}
          <strong>2. Google Cloud Console</strong> → APIs & Services → Credentials → your OAuth client:
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
            <li>
              Add <code className="font-mono">{origin}</code> to Authorized JavaScript origins.
            </li>
            <li>
              Add <code className="font-mono">{`${origin}/__/auth/handler`}</code> to Authorized redirect URIs.
            </li>
          </ul>
          <strong>3. Environment variable (Vercel/Netlify):</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
            <li>
              Set <code className="font-mono">NEXT_PUBLIC_APP_URL={origin}</code> in your platform&apos;s Environment Variables.
            </li>
          </ul>
        </div>
        <button
          onClick={dismiss}
          className="ml-auto p-1 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50"
          aria-label="Dismiss setup banner"
        >
          <ChevronDown className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </div>
  );
}
