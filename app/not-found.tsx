import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-sm text-zinc-500 mb-6">Could not find the requested resource.</p>
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
