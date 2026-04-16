"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Phone, MapPin, ChevronUp, ChevronDown, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ResourceResult } from "@/types/index";
import Link from "next/link";

interface ResourceCardProps {
  resource: ResourceResult;
}

export function ResourceCard({ resource: initialResource }: ResourceCardProps) {
  const [resource, setResource] = useState(initialResource);
  const [voting, setVoting] = useState(false);
  const router = useRouter();

  async function handleVote(vote: 1 | -1) {
    if (voting) return;
    setVoting(true);
    try {
      if (resource.user_vote === vote) {
        const res = await fetch(`/api/resources/${resource.id}/vote`, { method: "DELETE" });
        if (res.ok) {
          const data = await res.json();
          setResource((r) => ({ ...r, net_score: data.net_score, user_vote: null }));
        } else if (res.status === 401) {
          router.push(`/signin?returnTo=/results?zip=${new URLSearchParams(window.location.search).get("zip") || ""}`);
        }
      } else {
        const res = await fetch(`/api/resources/${resource.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote }),
        });
        if (res.ok) {
          const data = await res.json();
          setResource((r) => ({ ...r, net_score: data.net_score, user_vote: data.user_vote }));
        } else if (res.status === 401) {
          router.push(`/signin?returnTo=/results?zip=${new URLSearchParams(window.location.search).get("zip") || ""}`);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setVoting(false);
    }
  }

  const verifiedDate = resource.verified_at
    ? new Date(resource.verified_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card
      className="focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
      tabIndex={0}
    >
      <div className="flex gap-3">
        {/* Vote buttons */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
          <button
            onClick={() => handleVote(1)}
            disabled={voting}
            className={`p-0.5 rounded transition-colors ${
              resource.user_vote === 1
                ? "text-primary bg-primary-light"
                : "text-muted hover:text-primary hover:bg-primary-light"
            }`}
            aria-label="Upvote"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <span className={`text-xs font-semibold tabular-nums ${
            resource.net_score > 0 ? "text-primary" : resource.net_score < 0 ? "text-error" : "text-muted"
          }`}>
            {resource.net_score}
          </span>
          <button
            onClick={() => handleVote(-1)}
            disabled={voting}
            className={`p-0.5 rounded transition-colors ${
              resource.user_vote === -1
                ? "text-error bg-red-50"
                : "text-muted hover:text-error hover:bg-red-50"
            }`}
            aria-label="Downvote"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2 flex-1 min-w-0">
          {/* Name + Badge */}
          <div className="flex flex-wrap items-start gap-2">
            <Link
              href={`/resources/${resource.id}`}
              className="text-primary hover:underline font-semibold text-lg focus:outline-none"
            >
              {resource.name}
            </Link>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-primary shrink-0"
              aria-label="Visit website"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
            {resource.distance_miles != null ? (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                {resource.distance_miles.toFixed(1)} mi
              </span>
            ) : (
              <Badge scope={resource.scope} />
            )}
          </div>

          {/* URL preview */}
          {resource.url && (() => {
            try {
              return (
                <p className="text-xs text-muted truncate">
                  {new URL(resource.url).hostname.replace(/^www\./, "")}
                </p>
              );
            } catch {
              return null;
            }
          })()}

          {/* Description */}
          <p className="text-foreground text-sm leading-relaxed line-clamp-2">
            {resource.description}
          </p>

          {/* Eligibility */}
          {resource.eligibility_summary && (
            <p className="text-muted text-sm line-clamp-1">
              <span className="font-medium">Eligibility:</span>{" "}
              {resource.eligibility_summary}
            </p>
          )}

          {/* Contact info + detail link */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm items-center">
            {resource.phone && (
              <a
                href={`tel:${resource.phone}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Phone className="w-4 h-4" aria-hidden="true" />
                {resource.phone}
              </a>
            )}
            {resource.address && (
              <span className="inline-flex items-center gap-1 text-muted">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                {resource.address}
              </span>
            )}
            <Link
              href={`/resources/${resource.id}`}
              className="inline-flex items-center gap-1 text-muted hover:text-primary transition-colors"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              Details &amp; comments
            </Link>
          </div>

          {/* Verified date */}
          {verifiedDate && (
            <p className="text-xs text-muted pt-1">Verified {verifiedDate}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
