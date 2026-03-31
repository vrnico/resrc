"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Shield, Users, Flag, FileText, Check, X, Eye } from "lucide-react";

interface AdminAmbassador {
  id: string;
  displayName: string;
  email: string;
  bio: string | null;
  zipCode: string;
  radius: number;
  status: string;
  role: string;
  postCount: number;
  verifiedAt: string | null;
  createdAt: string;
}

interface ModPost {
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
  zip: { city: string; stateCode: string };
  ambassador: { id: string; displayName: string; role: string } | null;
}

export function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"ambassadors" | "moderation">("ambassadors");
  const [ambassadors, setAmbassadors] = useState<AdminAmbassador[]>([]);
  const [posts, setPosts] = useState<ModPost[]>([]);
  const [loading, setLoading] = useState(false);

  function authHeaders() {
    return { Authorization: `Bearer ${password}` };
  }

  async function loadData() {
    setLoading(true);
    try {
      const [ambRes, modRes] = await Promise.all([
        fetch("/api/admin/ambassadors", { headers: authHeaders() }),
        fetch("/api/admin/moderation", { headers: authHeaders() }),
      ]);

      if (!ambRes.ok) throw new Error("Unauthorized");

      const ambData = await ambRes.json();
      const modData = await modRes.json();
      setAmbassadors(ambData.ambassadors || []);
      setPosts(modData.posts || []);
      setAuthed(true);
    } catch {
      setAuthed(false);
      alert("Invalid admin password");
    } finally {
      setLoading(false);
    }
  }

  async function updateAmbassador(id: string, status: string) {
    await fetch("/api/admin/ambassadors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id, status }),
    });
    loadData();
  }

  async function moderatePost(id: string, action: string) {
    await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id, action }),
    });
    loadData();
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadData();
            }}
            className="space-y-4"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? "Checking..." : "Sign In"}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  const pendingAmbassadors = ambassadors.filter((a) => a.status === "pending");
  const flaggedPosts = posts.filter((p) => p.flags >= 3 || p.status === "flagged");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <button
          onClick={loadData}
          className="text-sm text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center py-4">
          <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold">{ambassadors.length}</p>
          <p className="text-xs text-muted">Ambassadors</p>
        </Card>
        <Card className="text-center py-4">
          <Shield className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
          <p className="text-2xl font-bold">{pendingAmbassadors.length}</p>
          <p className="text-xs text-muted">Pending Approval</p>
        </Card>
        <Card className="text-center py-4">
          <Flag className="w-5 h-5 mx-auto text-red-500 mb-1" />
          <p className="text-2xl font-bold">{flaggedPosts.length}</p>
          <p className="text-xs text-muted">Flagged Posts</p>
        </Card>
        <Card className="text-center py-4">
          <FileText className="w-5 h-5 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold">{posts.length}</p>
          <p className="text-xs text-muted">Total Posts</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setTab("ambassadors")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "ambassadors"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Ambassadors ({ambassadors.length})
        </button>
        <button
          onClick={() => setTab("moderation")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "moderation"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Moderation ({flaggedPosts.length})
        </button>
      </div>

      {/* Ambassador Management */}
      {tab === "ambassadors" && (
        <div className="space-y-3">
          {ambassadors.length === 0 ? (
            <p className="text-center text-muted py-8">No ambassador applications yet.</p>
          ) : (
            ambassadors.map((amb) => (
              <Card key={amb.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{amb.displayName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        amb.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : amb.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {amb.status}
                      </span>
                      <span className="text-xs text-muted">{amb.role}</span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {amb.email} &middot; {amb.zipCode} &middot; {amb.postCount} posts
                    </p>
                    {amb.bio && <p className="text-xs text-muted mt-1 line-clamp-2">{amb.bio}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {amb.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateAmbassador(amb.id, "approved")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => updateAmbassador(amb.id, "suspended")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {amb.status === "approved" && (
                      <button
                        onClick={() => updateAmbassador(amb.id, "suspended")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                      >
                        Suspend
                      </button>
                    )}
                    {amb.status === "suspended" && (
                      <button
                        onClick={() => updateAmbassador(amb.id, "approved")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                      >
                        Reinstate
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Moderation Queue */}
      {tab === "moderation" && (
        <div className="space-y-3">
          {flaggedPosts.length === 0 ? (
            <p className="text-center text-muted py-8">No flagged posts.</p>
          ) : (
            flaggedPosts.map((post) => (
              <Card key={post.id}>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.title && (
                        <span className="font-medium text-foreground text-sm">{post.title}</span>
                      )}
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {post.flags} flags
                      </span>
                      {post.ambassador && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          by {post.ambassador.displayName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap">
                      {post.zip.city}, {post.zip.stateCode}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{post.body}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => moderatePost(post.id, "approve")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                    >
                      <Eye className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => moderatePost(post.id, "remove")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
