"use client";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h2 className="font-serif text-xl font-bold text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-vand-sand/60 text-sm mb-4">
          {error.message || "Failed to load profile"}
        </p>
        {error.digest && (
          <p className="text-vand-sand/30 text-xs mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2 bg-vand-gold text-vand-black font-condensed font-bold uppercase tracking-wider text-sm rounded"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
