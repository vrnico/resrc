"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export default function GitHubContributors() {
  const [contributors, setContributors] = useState<GitHubUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContributors() {
      try {
        // Fetch both contributors and forkers in parallel
        const [contribRes, forksRes] = await Promise.all([
          fetch("https://api.github.com/repos/vrnico/resrc/contributors"),
          fetch("https://api.github.com/repos/vrnico/resrc/forks"),
        ]);

        const seen = new Set<string>();
        const users: GitHubUser[] = [];

        if (contribRes.ok) {
          const contribs = await contribRes.json();
          for (const c of contribs) {
            if (!seen.has(c.login)) {
              seen.add(c.login);
              users.push({ login: c.login, avatar_url: c.avatar_url, html_url: c.html_url });
            }
          }
        }

        if (forksRes.ok) {
          const forks = await forksRes.json();
          for (const f of forks) {
            const owner = f.owner;
            if (!seen.has(owner.login)) {
              seen.add(owner.login);
              users.push({ login: owner.login, avatar_url: owner.avatar_url, html_url: owner.html_url });
            }
          }
        }

        setContributors(users);
      } catch {
        // Silently fail — this is non-critical
      } finally {
        setLoading(false);
      }
    }

    fetchContributors();
  }, []);

  if (loading) {
    return (
      <div className="flex gap-3 flex-wrap">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-12 h-12 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (contributors.length === 0) return null;

  return (
    <div className="flex gap-4 flex-wrap">
      {contributors.map((user) => (
        <a
          key={user.login}
          href={user.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 group"
        >
          <Image
            src={user.avatar_url}
            alt={user.login}
            width={48}
            height={48}
            className="rounded-full border-2 border-border group-hover:border-primary transition-colors"
          />
          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
            {user.login}
          </span>
        </a>
      ))}
    </div>
  );
}
