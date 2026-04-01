"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

export function AmbassadorAuth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regZip, setRegZip] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push("/ambassador/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: regName,
          email: regEmail,
          password: regPassword,
          bio: regBio || undefined,
          zipCode: regZip,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess("Account created! Check your email to confirm, then sign in.");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => { setMode("login"); setError(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "login" ? "bg-white text-foreground shadow-sm" : "text-muted"
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setMode("register"); setError(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "register" ? "bg-white text-foreground shadow-sm" : "text-muted"
          }`}
        >
          Sign Up
        </button>
      </div>

      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {mode === "login" ? (
        <Card>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-foreground mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleRegister} className="space-y-4">
            <p className="text-sm text-muted">
              Pick a pseudonym to protect your identity. We only use your zip code to show your region.
            </p>
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-foreground mb-1">
                Display Name (pseudonym)
              </label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                minLength={2}
                maxLength={50}
                placeholder="e.g., HelpfulNeighbor42"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-foreground mb-1">
                Email (private, never shown)
              </label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-foreground mb-1">
                Password (min 8 characters)
              </label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="reg-zip" className="block text-sm font-medium text-foreground mb-1">
                Your Zip Code (determines your region)
              </label>
              <input
                id="reg-zip"
                type="text"
                value={regZip}
                onChange={(e) => setRegZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                required
                pattern="\d{5}"
                inputMode="numeric"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="reg-bio" className="block text-sm font-medium text-foreground mb-1">
                Bio (optional)
              </label>
              <textarea
                id="reg-bio"
                value={regBio}
                onChange={(e) => setRegBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Tell the community a little about yourself..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
            <p className="text-xs text-muted text-center">
              Your email is kept private. Other users only see your display name and region.
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}
