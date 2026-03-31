"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, Flag, Shield, Pin, Clock, Plus, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FeedResponse, FeedPost } from "@/types/index";
import { POST_CATEGORY_LABELS, POST_CATEGORIES } from "@/lib/constants";

interface FeedContentProps {
  zip: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function PostCard({ post, onUpvote }: { post: FeedPost; onUpvote: () => void }) {
  const [flagged, setFlagged] = useState(false);

  async function handleFlag() {
    if (flagged) return;
    await fetch(`/api/feed/${post.id}/flag`, { method: "POST" });
    setFlagged(true);
  }

  const isAmbassador = post.postType === "ambassador" && post.ambassador;
  const categoryLabel = POST_CATEGORY_LABELS[post.category] ?? post.category;

  return (
    <Card className={`${post.isPinned ? "border-primary border-2" : ""} ${isAmbassador ? "bg-blue-50/50" : ""}`}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                <Pin className="w-3 h-3" /> Pinned
              </span>
            )}
            {isAmbassador && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                <Shield className="w-3 h-3" />
                {post.ambassador!.displayName}
                {post.ambassador!.role === "moderator" && " (Mod)"}
              </span>
            )}
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {categoryLabel}
            </span>
          </div>
          <span className="text-xs text-muted whitespace-nowrap flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(post.createdAt)}
          </span>
        </div>

        {/* Title (ambassador posts) */}
        {post.title && (
          <h3 className="font-semibold text-foreground">{post.title}</h3>
        )}

        {/* Body */}
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {post.body}
        </p>

        {/* Expiry */}
        {post.expiresAt && (
          <p className="text-xs text-muted">
            Expires {new Date(post.expiresAt).toLocaleDateString()}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={onUpvote}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary transition-colors"
            aria-label={`Upvote (${post.upvotes})`}
          >
            <ThumbsUp className="w-4 h-4" />
            {post.upvotes > 0 && <span>{post.upvotes}</span>}
          </button>
          <button
            onClick={handleFlag}
            disabled={flagged}
            className={`inline-flex items-center gap-1 text-sm transition-colors ${
              flagged ? "text-red-400 cursor-not-allowed" : "text-muted hover:text-red-500"
            }`}
            aria-label="Flag post"
          >
            <Flag className="w-4 h-4" />
            {flagged && <span className="text-xs">Flagged</span>}
          </button>
        </div>
      </div>
    </Card>
  );
}

function NewPostForm({ zip, onPostCreated }: { zip: string; onPostCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("tip");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, body: body.trim(), category }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create post");
      }

      setBody("");
      setCategory("tip");
      setOpen(false);
      onPostCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-border rounded-lg text-muted hover:text-foreground hover:border-primary transition-colors"
      >
        <Plus className="w-5 h-5" />
        Share a tip with your community
      </button>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {POST_CATEGORIES.slice(0, 4).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                category === cat
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {POST_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share a resource, tip, or question with your community..."
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{body.length}/1000</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setBody(""); setError(null); }}
              className="px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Post
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
      </form>
    </Card>
  );
}

export function FeedContent({ zip }: FeedContentProps) {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function loadFeed() {
    setLoading(true);
    fetch(`/api/feed?zip=${zip}`)
      .then((res) => res.json())
      .then((json: FeedResponse) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadFeed(); }, [zip]);

  async function handleUpvote(postId: string) {
    await fetch(`/api/feed/${postId}/upvote`, { method: "POST" });
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        posts: prev.posts.map((p) =>
          p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p
        ),
      };
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-14 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          Community Feed
        </h1>
        {data && data.ambassadorCount > 0 && (
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            <Shield className="w-3 h-3 inline mr-1" />
            {data.ambassadorCount} ambassador{data.ambassadorCount !== 1 ? "s" : ""} active
          </span>
        )}
      </div>

      <NewPostForm zip={zip} onPostCreated={loadFeed} />

      {data && data.posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted">No posts yet in your area.</p>
          <p className="text-sm text-muted mt-1">Be the first to share a tip or resource.</p>
        </div>
      ) : (
        data?.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onUpvote={() => handleUpvote(post.id)}
          />
        ))
      )}

      {data && data.totalPages > 1 && (
        <p className="text-center text-sm text-muted pt-4">
          Showing page {data.page} of {data.totalPages} ({data.total} total posts)
        </p>
      )}
    </div>
  );
}
