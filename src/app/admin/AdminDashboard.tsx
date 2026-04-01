"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Shield, Users, Flag, FileText, Calendar, Check, X, Eye } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";

interface AdminUser {
  id: string;
  display_name: string;
  zip_code: string;
  role: string;
  status: string;
  bio: string | null;
  city: string;
  state_code: string;
  created_at: string;
}

interface ModPost {
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
  author_name: string | null;
  author_city: string | null;
  author_state: string | null;
}

interface ModEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  event_date: string;
  location: string | null;
  status: string;
  author_name: string;
  event_city: string;
  event_state: string;
  created_at: string;
}

export function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [tab, setTab] = useState<"users" | "moderation" | "events">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<ModPost[]>([]);
  const [events, setEvents] = useState<ModEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if user is already authenticated as admin
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        if (data.role === "admin") {
          setAuthed(true);
          loadData();
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, postsRes, eventsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/moderation"),
        fetch("/api/admin/moderation?type=events"),
      ]);

      if (!usersRes.ok) throw new Error("Unauthorized");

      const usersData = await usersRes.json();
      const postsData = await postsRes.json();
      const eventsData = await eventsRes.json();

      setUsers(usersData.users || []);
      setPosts(postsData.posts || []);
      setEvents(eventsData.events || []);
      setAuthed(true);
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(userId: string, field: "role" | "status", value: string) {
    const body = field === "role"
      ? { userId, role: value }
      : { userId, status: value };

    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    loadData();
  }

  async function moderatePost(id: string, action: string) {
    await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    loadData();
  }

  async function moderateEvent(id: string, action: string) {
    await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "event", action }),
    });
    loadData();
  }

  if (checkingAuth) {
    return <div className="text-center py-12 text-muted">Checking authentication...</div>;
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <h1 className="text-2xl font-bold text-center mb-6">Admin Access</h1>
        <Card>
          <p className="text-sm text-muted text-center py-4">
            Sign in with an admin account to access this dashboard.
          </p>
          <a
            href="/ambassador"
            className="block w-full py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover text-center"
          >
            Sign In
          </a>
        </Card>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => u.status === "pending");
  const flaggedPosts = posts.filter((p) => p.flags >= 3 || p.status === "flagged");
  const pendingEvents = events.filter((e) => e.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <button onClick={loadData} className="text-sm text-primary hover:underline">
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center py-4">
          <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold">{users.length}</p>
          <p className="text-xs text-muted">Users</p>
        </Card>
        <Card className="text-center py-4">
          <Shield className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
          <p className="text-2xl font-bold">{users.filter((u) => u.role === "moderator").length}</p>
          <p className="text-xs text-muted">Moderators</p>
        </Card>
        <Card className="text-center py-4">
          <Flag className="w-5 h-5 mx-auto text-red-500 mb-1" />
          <p className="text-2xl font-bold">{flaggedPosts.length}</p>
          <p className="text-xs text-muted">Flagged Posts</p>
        </Card>
        <Card className="text-center py-4">
          <Calendar className="w-5 h-5 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold">{pendingEvents.length}</p>
          <p className="text-xs text-muted">Pending Events</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        {(["users", "moderation", "events"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t === "users" && `Users (${users.length})`}
            {t === "moderation" && `Moderation (${flaggedPosts.length})`}
            {t === "events" && `Events (${pendingEvents.length})`}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="text-center text-muted py-8">No users yet.</p>
          ) : (
            users.map((user) => (
              <Card key={user.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{user.display_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700"
                          : user.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {user.status}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {user.city}, {user.state_code} ({user.zip_code})
                    </p>
                    {user.bio && <p className="text-xs text-muted mt-1 line-clamp-2">{user.bio}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <select
                      value={user.role}
                      onChange={(e) => updateUser(user.id, "role", e.target.value)}
                      className="text-xs border border-border rounded px-2 py-1"
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="social_worker">Social Worker</option>
                      <option value="admin">Admin</option>
                    </select>
                    {user.status === "active" ? (
                      <button
                        onClick={() => updateUser(user.id, "status", "suspended")}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => updateUser(user.id, "status", "active")}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Moderation Tab */}
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
                      {post.author_name && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          by {post.author_name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap">
                      {post.author_city && `${post.author_city}, ${post.author_state}`}
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

      {/* Events Tab */}
      {tab === "events" && (
        <div className="space-y-3">
          {pendingEvents.length === 0 ? (
            <p className="text-center text-muted py-8">No pending events.</p>
          ) : (
            pendingEvents.map((event) => (
              <Card key={event.id}>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-foreground">{event.title}</h3>
                      <p className="text-xs text-muted">
                        by {event.author_name} &middot; {event.event_city}, {event.event_state}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">{new Date(event.event_date).toLocaleDateString()}</p>
                      <p className="text-xs text-muted">{event.category.replace("_", " ")}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground line-clamp-3">{event.description}</p>
                  {event.location && (
                    <p className="text-xs text-muted">Location: {event.location}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => moderateEvent(event.id, "approve")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => moderateEvent(event.id, "reject")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                    >
                      <X className="w-3 h-3" /> Reject
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
