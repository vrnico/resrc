"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserInfo {
  display_name: string;
  role: string;
}

export function SiteHeader() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data.profile);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-primary">
            resrc
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/about" className="text-muted hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/report" className="text-muted hover:text-foreground transition-colors">
              Report
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {loading ? (
            <div className="w-20 h-8" />
          ) : user ? (
            <>
              <Link
                href="/ambassador/dashboard"
                className="text-foreground font-medium hover:text-primary transition-colors"
              >
                {user.display_name}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-muted hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="text-muted hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signin?mode=register"
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
