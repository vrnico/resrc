"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Shield, Plus, LogOut, Send, Eye, EyeOff } from "lucide-react";
import type { AmbassadorProfile } from "@/types/index";
import { POST_CATEGORIES, POST_CATEGORY_LABELS } from "@/lib/constants";

interface DashboardPost {
  id: string;
  title: string | null;
  body: string;
  category: string;
  postType: string;
  upvotes: number;
  flags: number;
  status: string;
  isPinned: boolean;
  createdAt: string;
  expiresAt: string | null;
  zip: { zip: string; city: string; stateCode: string };
}

export function AmbassadorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);

  // New post form
  const [postZip, setPostZip] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postCategory, setPostCategory] = useState("resource");
  const [postExpiry, setPostExpiry] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/ambassadors/me").then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      }),
      fetch("/api/ambassadors/posts").then((r) => r.json()),
    ])
      .then(([profileData, postsData]) => {
        setProfile(profileData);
        setPosts(postsData.posts || []);
        setPostZip(profileData.zipCode);
      })
      .catch(() => {
        router.push("/ambassador");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/ambassadors/me", { method: "DELETE" });
    router.push("/ambassador");
  }

  async function handleNewPost(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setPostError(null);

    try {
      const res = await fetch("/api/ambassadors/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip: postZip,
          title: postTitle,
          body: postBody,
          category: postCategory,
          expiresInDays: postExpiry ? parseInt(postExpiry) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refresh posts
      const postsRes = await fetch("/api/ambassadors/posts");
      const postsData = await postsRes.json();
      setPosts(postsData.posts || []);

      setShowNewPost(false);
      setPostTitle("");
      setPostBody("");
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading...</div>;
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-foreground">{profile.displayName}</h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {profile.role}
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            {profile.zipCode} &middot; {profile.radius} mile radius
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-foreground">{posts.length}</p>
          <p className="text-xs text-muted">Posts</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-foreground">
            {posts.reduce((sum, p) => sum + p.upvotes, 0)}
          </p>
          <p className="text-xs text-muted">Total Upvotes</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-foreground">
            {posts.filter((p) => p.status === "visible").length}
          </p>
          <p className="text-xs text-muted">Active</p>
        </Card>
      </div>

      {/* New Post Button / Form */}
      {!showNewPost ? (
        <button
          onClick={() => setShowNewPost(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Community Post
        </button>
      ) : (
        <Card>
          <form onSubmit={handleNewPost} className="space-y-4">
            <h2 className="font-semibold text-foreground">New Ambassador Post</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Zip Code</label>
                <input
                  type="text"
                  value={postZip}
                  onChange={(e) => setPostZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  required
                  pattern="\d{5}"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Expires in (days)</label>
                <input
                  type="number"
                  value={postExpiry}
                  onChange={(e) => setPostExpiry(e.target.value)}
                  min="1"
                  max="90"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Category</label>
              <div className="flex gap-2 flex-wrap">
                {POST_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPostCategory(cat)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      postCategory === cat
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {POST_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Title</label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g., Free food distribution this Saturday"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Details</label>
              <textarea
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                required
                rows={4}
                maxLength={2000}
                placeholder="Provide details about this resource or event..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted mt-1">{postBody.length}/2000</p>
            </div>

            {postError && <p className="text-sm text-error">{postError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowNewPost(false)}
                className="px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Posting..." : "Publish"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Posts list */}
      <div className="space-y-3">
        <h2 className="font-semibold text-foreground">Your Posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">
            No posts yet. Create your first community post above.
          </p>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className={post.status !== "visible" ? "opacity-60" : ""}>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {post.title && (
                      <span className="font-medium text-foreground text-sm">{post.title}</span>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {POST_CATEGORY_LABELS[post.category as keyof typeof POST_CATEGORY_LABELS] ?? post.category}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    {post.status === "visible" ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                    {post.status}
                  </span>
                </div>
                <p className="text-xs text-muted line-clamp-2">{post.body}</p>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>{post.zip.city}, {post.zip.stateCode}</span>
                  <span>{post.upvotes} upvotes</span>
                  {post.flags > 0 && <span className="text-red-500">{post.flags} flags</span>}
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
