"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function ZipInput() {
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = zip.trim();

    if (!/^\d{5}$/.test(trimmed)) {
      setError("Please enter a valid 5-digit zip code.");
      inputRef.current?.focus();
      return;
    }

    setError("");
    router.push(`/results?zip=${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            value={zip}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              setZip(val);
              if (error) setError("");
            }}
            placeholder="Enter zip code"
            aria-label="Zip code"
            aria-invalid={!!error}
            aria-describedby={error ? "zip-error" : undefined}
            className={`w-full px-4 py-3 text-lg border-2 rounded-lg bg-white text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
              error ? "border-error" : "border-border"
            }`}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-lg font-medium text-white bg-primary rounded-lg hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors min-w-[44px] min-h-[44px]"
        >
          <Search className="w-5 h-5" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
      {error && (
        <p id="zip-error" role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </form>
  );
}
