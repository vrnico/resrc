"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Phone, MapPin, ChevronUp, ChevronDown, MessageSquare, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ResourceResult, ResourceComment } from "@/types/index";

interface ResourceDetailProps {
  id: string;
}

export function ResourceDetail({ id }: ResourceDetailProps) {
  const [resource, setResource] = useState<ResourceResult | null>(null);
  const [comments, setComments] = useState<ResourceComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState(false);
  const router = useRouter();

  const fetchResource = useCallback(async () => {
    try {
      const res = await fetch(`/api/resources/${id}`);
      if (!res.ok) throw new Error("Resource not found");
      const data = await res.json();
      setResource({
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        subcategory: data.subcategory,
        scope: data.scope,
        url: data.url,
        phone: data.phone,
        address: data.address,
        eligibility_summary: data.eligibility_summary,
        income_limit_notes: data.income_limit_notes,
        hours: data.hours,
        languages: data.languages,
        net_score: data.net_score,
        verified_at: data.verified_at,
        user_vote: data.user_vote,
      });
    } catch {
      setError("Resource not found");
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/resources/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch {
      // Non-critical
    }
  }, [id]);

  useEffect(() => {
    Promise.all([fetchResource(), fetchComments()]).finally(() =>
      setLoading(false)
    );
  }, [fetchResource, fetchComments]);

  async function handleVote(vote: 1 | -1) {
    if (voting || !resource) return;
    setVoting(true);
    try {
      if (resource.user_vote === vote) {
        // Remove vote
        const res = await fetch(`/api/resources/${id}/vote`, { method: "DELETE" });
        if (res.ok) {
          const data = await res.json();
          setResource((r) => r ? { ...r, net_score: data.net_score, user_vote: null } : r);
        } else if (res.status === 401) {
          router.push(`/signin?returnTo=/resources/${id}`);
        }
      } else {
        const res = await fetch(`/api/resources/${id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote }),
        });
        if (res.ok) {
          const data = await res.json();
          setResource((r) => r ? { ...r, net_score: data.net_score, user_vote: data.user_vote } : r);
        } else if (res.status === 401) {
          router.push(`/signin?returnTo=/resources/${id}`);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setVoting(false);
    }
  }

  async function handleComment(body: string, parentId?: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/resources/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId }),
      });
      if (res.status === 401) {
        router.push(`/signin?returnTo=/resources/${id}`);
        return;
      }
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setCommentBody("");
        setReplyTo(null);
        setReplyBody("");
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-error font-medium">{error ?? "Resource not found"}</p>
        <Link href="/" className="mt-4 inline-block text-primary hover:underline">
          Back to search
        </Link>
      </div>
    );
  }

  const verifiedDate = resource.verified_at
    ? new Date(resource.verified_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Build comment tree from flat list
  const commentTree = buildCommentTree(comments);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="javascript:history.back()"
        onClick={(e) => { e.preventDefault(); window.history.back(); }}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to results
      </Link>

      {/* Resource card with voting */}
      <Card>
        <div className="flex gap-4">
          {/* Vote column */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={() => handleVote(1)}
              disabled={voting}
              className={`p-1 rounded transition-colors ${
                resource.user_vote === 1
                  ? "text-primary bg-primary-light"
                  : "text-muted hover:text-primary hover:bg-primary-light"
              }`}
              aria-label="Upvote"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
            <span className={`text-sm font-semibold tabular-nums ${
              resource.net_score > 0 ? "text-primary" : resource.net_score < 0 ? "text-error" : "text-muted"
            }`}>
              {resource.net_score}
            </span>
            <button
              onClick={() => handleVote(-1)}
              disabled={voting}
              className={`p-1 rounded transition-colors ${
                resource.user_vote === -1
                  ? "text-error bg-red-50"
                  : "text-muted hover:text-error hover:bg-red-50"
              }`}
              aria-label="Downvote"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          </div>

          {/* Resource info */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {resource.name}
              </h1>
              <Badge scope={resource.scope} />
            </div>

            {resource.category && (
              <p className="text-sm text-muted">
                {resource.category.icon} {resource.category.name}
                {resource.subcategory && ` / ${resource.subcategory}`}
              </p>
            )}

            <p className="text-foreground leading-relaxed">{resource.description}</p>

            {resource.eligibility_summary && (
              <div className="text-sm">
                <span className="font-medium text-foreground">Eligibility: </span>
                <span className="text-muted">{resource.eligibility_summary}</span>
              </div>
            )}

            {resource.income_limit_notes && (
              <div className="text-sm">
                <span className="font-medium text-foreground">Income limits: </span>
                <span className="text-muted">{resource.income_limit_notes}</span>
              </div>
            )}

            {resource.hours && (
              <div className="text-sm">
                <span className="font-medium text-foreground">Hours: </span>
                <span className="text-muted">{resource.hours}</span>
              </div>
            )}

            {resource.languages && (
              <div className="text-sm">
                <span className="font-medium text-foreground">Languages: </span>
                <span className="text-muted">{resource.languages}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm pt-1">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                Visit website
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
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
            </div>

            {verifiedDate && (
              <p className="text-xs text-muted">Verified {verifiedDate}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Comments section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Comments ({comments.length})
        </h2>

        {/* New comment form */}
        <div className="mt-4">
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Share your experience with this resource..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            rows={3}
            maxLength={2000}
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => handleComment(commentBody)}
              disabled={submitting || !commentBody.trim()}
            >
              {submitting ? "Posting..." : "Post comment"}
            </Button>
          </div>
        </div>

        {/* Comment list */}
        <div className="mt-4 space-y-3">
          {commentTree.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">
              No comments yet. Be the first to share your experience.
            </p>
          ) : (
            commentTree.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                replyTo={replyTo}
                replyBody={replyBody}
                submitting={submitting}
                onSetReplyTo={setReplyTo}
                onSetReplyBody={setReplyBody}
                onSubmitReply={(body, parentId) => handleComment(body, parentId)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- Comment tree builder ---

function buildCommentTree(flat: ResourceComment[]): ResourceComment[] {
  const map = new Map<string, ResourceComment>();
  const roots: ResourceComment[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// --- Comment component ---

interface CommentNodeProps {
  comment: ResourceComment;
  replyTo: string | null;
  replyBody: string;
  submitting: boolean;
  onSetReplyTo: (id: string | null) => void;
  onSetReplyBody: (body: string) => void;
  onSubmitReply: (body: string, parentId: string) => void;
}

function CommentNode({
  comment,
  replyTo,
  replyBody,
  submitting,
  onSetReplyTo,
  onSetReplyBody,
  onSubmitReply,
}: CommentNodeProps) {
  const date = new Date(comment.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={comment.depth > 0 ? "ml-6 pl-4 border-l-2 border-border" : ""}>
      <div className="py-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-foreground">{comment.author_name}</span>
          {comment.author_city && comment.author_state && (
            <span>
              {comment.author_city}, {comment.author_state}
            </span>
          )}
          <span>{date}</span>
        </div>
        <p className="mt-1 text-sm text-foreground">{comment.body}</p>
        {comment.depth < 5 && (
          <button
            onClick={() => onSetReplyTo(replyTo === comment.id ? null : comment.id)}
            className="mt-1 text-xs text-muted hover:text-primary transition-colors"
          >
            Reply
          </button>
        )}

        {/* Reply form */}
        {replyTo === comment.id && (
          <div className="mt-2">
            <textarea
              value={replyBody}
              onChange={(e) => onSetReplyBody(e.target.value)}
              placeholder={`Reply to ${comment.author_name}...`}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              rows={2}
              maxLength={2000}
            />
            <div className="mt-1 flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { onSetReplyTo(null); onSetReplyBody(""); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => onSubmitReply(replyBody, comment.id)}
                disabled={submitting || !replyBody.trim()}
              >
                {submitting ? "Posting..." : "Reply"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              replyTo={replyTo}
              replyBody={replyBody}
              submitting={submitting}
              onSetReplyTo={onSetReplyTo}
              onSetReplyBody={onSetReplyBody}
              onSubmitReply={onSubmitReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
