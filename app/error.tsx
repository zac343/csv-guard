"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CSV Guard render error", error);
  }, [error]);

  return (
    <main className="error-page">
      <p className="eyebrow">The page hit a snag</p>
      <h1>Your CSV is still on your device.</h1>
      <p>No CSV contents were uploaded. Reload the workbench and try again.</p>
      <button type="button" className="primary-button" onClick={reset}>
        Reload CSV Guard
      </button>
    </main>
  );
}
