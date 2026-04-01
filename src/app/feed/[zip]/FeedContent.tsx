"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Flag, Shield, Pin, Clock, Plus, Send } from "lucide-react";
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

function PostCard({ post, onVote }: { post: FeedPost; onVote: (vote: 1 | -1) => void }) {
  const [flagged, setFlagged] = useState(false);

  async function handleFlag() {
    if (flagged) return;
    await fetch(`/api/feed/${post.id}/flag`, { method: "POST" });
    setFlagged(true);
  }

  const isModerator = post.author_name && post.author_state;
  const categoryLabel = POST_CATEGORY_LABELS[post.category] ?? post.category;
  const netVotes = post.upvotes - post.downvotes;

  return (
    <Card className={`${post.is_pinned ? "border-primary border-2" : ""}`}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                <Pin className="w-3 h-3" /> Pinned
              </span>
            )}
            {post.author_name && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                <Shield className="w-3 h-3" />
                {post.author_name}
                {post.author_city && ` from ${post.author_city}, ${post.author_state}`}
              </span>
            )}
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {categoryLabel}
            </span>
          </div>
          <span className="text-xs text-muted whitespace-nowrap flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(post.created_at)}
          </span>
        </div>

        {/* Title */}
        {post.title && (
          <h3 className="font-semibold text-foreground">{post.title}</h3>
        )}

        {/* Body */}
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {post.body}
        </p>

        {/* Expiry */}
        {post.expires_at && (
          <p className="text-xs text-muted">
            Expires {new Date(post.expires_at).toLocaleDateString()}
          </p>
        )}

        {/* Actions — Reddit-style voting */}
        <div className="flex items-center gap-4 pt-1">
          <div className="inline-flex items-center gap-1">
            <button
              onClick={() => onVote(1)}
              className={`p-1 rounded transition-colors ${
                post.user_vote === 1
                  ? "text-primary"
                  : "text-muted hover:text-primary"
              }`}
              aria-label="Upvote"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <span className={`text-sm font-medium ${
              netVotes > 0 ? "text-primary" : netVotes < 0 ? "text-red-500" : "text-muted"
            }`}>
              {netVotes}
            </span>
            <button
              onClick={() => onVote(-1)}
              className={`p-1 rounded transition-colors ${
                post.user_vote === -1
                  ? "text-red-500"
                  : "text-muted hover:text-red-500"
              }`}
              aria-label="Downvote"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
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
          maxLength={2000}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{body.length}/2000</span>
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

  async function handleVote(postId: string, vote: 1 | -1) {
    const post = data?.posts.find((p) => p.id === postId);
    if (!post) return;

    // If already voted the same way, remove the vote
    if (post.user_vote === vote) {
      await fetch(`/api/feed/${postId}/vote`, { method: "DELETE" });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  upvotes: p.upvotes - (vote === 1 ? 1 : 0),
                  downvotes: p.downvotes - (vote === -1 ? 1 : 0),
                  user_vote: null,
                }
              : p
          ),
        };
      });
    } else {
      await fetch(`/api/feed/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) => {
            if (p.id !== postId) return p;
            let upvotes = p.upvotes;
            let downvotes = p.downvotes;
            // Remove old vote
            if (p.user_vote === 1) upvotes--;
            if (p.user_vote === -1) downvotes--;
            // Add new vote
            if (vote === 1) upvotes++;
            if (vote === -1) downvotes++;
            return { ...p, upvotes, downvotes, user_vote: vote as 1 | -1 };
          }),
        };
      });
    }
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
            onVote={(vote) => handleVote(post.id, vote)}
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
