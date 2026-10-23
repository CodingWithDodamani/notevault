import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoteVault Cloud',
  description:
    'Personal cloud study notes vault connected to Google Drive for PDFs, DOCX, and Samsung Notes.',
  openGraph: {
    title: 'NoteVault Cloud',
    description:
      'Personal cloud study notes vault connected to Google Drive for PDFs, DOCX, and Samsung Notes.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NoteVault Cloud',
    description:
      'Personal cloud study notes vault connected to Google Drive for PDFs, DOCX, and Samsung Notes.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
