"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Shield, Plus, LogOut, Send, Eye, EyeOff } from "lucide-react";
import type { UserProfile } from "@/types/index";
import { POST_CATEGORIES, POST_CATEGORY_LABELS, ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

interface DashboardPost {
  id: string;
  title: string | null;
  body: string;
  category: string;
  upvotes: number;
  downvotes: number;
  flags: number;
  status: string;
  is_pinned: boolean;
  created_at: string;
  expires_at: string | null;
  zip_code: string;
}

export function AmbassadorDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile & { city?: string; state_code?: string } | null>(null);
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
    async function load() {
      try {
        // Get current user profile
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error("Not authenticated");
        const profileData = await res.json();
        setProfile(profileData);
        setPostZip(profileData.zip_code);

        // Get user's posts
        const { data: userPosts } = await supabase
          .from("community_posts")
          .select("*")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });

        setPosts(userPosts ?? []);
      } catch {
        router.push("/ambassador");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/ambassador");
  }

  async function handleNewPost(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setPostError(null);

    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip: postZip,
          title: postTitle,
          body: postBody,
          category: postCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refresh posts
      if (profile) {
        const { data: userPosts } = await supabase
          .from("community_posts")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        setPosts(userPosts ?? []);
      }

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
            <h1 className="text-xl font-bold text-foreground">{profile.display_name}</h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            {profile.city && `${profile.city}, ${profile.state_code} · `}{profile.zip_code} · {profile.radius} mile radius
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
            {posts.reduce((sum, p) => sum + p.upvotes - p.downvotes, 0)}
          </p>
          <p className="text-xs text-muted">Net Score</p>
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
            <h2 className="font-semibold text-foreground">New Post</h2>

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
                <label className="block text-xs font-medium text-muted mb-1">Category</label>
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {POST_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{POST_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
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
                  <span>{post.zip_code}</span>
                  <span>{post.upvotes - post.downvotes} score</span>
                  {post.flags > 0 && <span className="text-red-500">{post.flags} flags</span>}
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
