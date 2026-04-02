"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Category {
  id: number;
  slug: string;
  name: string;
}

const SCOPES = [
  { value: "national", label: "National" },
  { value: "state", label: "State" },
  { value: "county", label: "County" },
  { value: "city", label: "City" },
  { value: "zip_specific", label: "Zip-specific" },
];

export function SubmitResourceForm() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [scope, setScope] = useState("state");
  const [url, setUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [county, setCounty] = useState("");

  useEffect(() => {
    // Check auth
    fetch("/api/auth/me")
      .then((r) => { setAuthed(r.ok); return r.ok ? r.json() : null; })
      .catch(() => setAuthed(false));

    // Fetch categories from the API by getting a dummy resource query
    // Actually, just hardcode a fetch to get categories from the DB
    fetch("/api/resources?zip=00000")
      .then((r) => r.json())
      .then((data) => {
        if (data.categories) {
          setCategories(data.categories.map((c: { slug: string; name: string }, i: number) => ({
            id: i + 1, slug: c.slug, name: c.name,
          })));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/resources/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, categoryId, scope, url,
          phone: phone || undefined,
          address: address || undefined,
          eligibilitySummary: eligibility || undefined,
          stateCode: stateCode || undefined,
          county: county || undefined,
        }),
      });

      if (res.status === 401) {
        router.push("/signin?returnTo=/submit");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (authed === false) {
    return (
      <Card>
        <p className="text-sm text-muted text-center py-4">
          You need to be signed in to submit a resource.
        </p>
        <a
          href="/signin?returnTo=/submit"
          className="block w-full py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover text-center"
        >
          Sign In
        </a>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <div className="text-center py-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Resource submitted</h2>
          <p className="text-sm text-muted">
            Thank you! A moderator will review your submission and approve it if it meets our guidelines.
          </p>
          <Button variant="secondary" onClick={() => { setSuccess(false); setName(""); setDescription(""); setUrl(""); }}>
            Submit another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Resource name *</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            required minLength={2} maxLength={200}
            placeholder="e.g., Bay Area Food Bank"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description *</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            required minLength={10} maxLength={2000} rows={3}
            placeholder="What does this program do? Who does it help?"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Website URL *</label>
          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            required placeholder="https://..."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category *</label>
            <select
              value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={0} disabled>Select...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Scope *</label>
            <select
              value={scope} onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {(scope === "state" || scope === "county" || scope === "city") && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">State code</label>
              <input
                type="text" value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2} placeholder="CA"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {(scope === "county" || scope === "city") && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">County</label>
                <input
                  type="text" value={county} onChange={(e) => setCounty(e.target.value)}
                  maxLength={100} placeholder="Los Angeles"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Phone (optional)</label>
          <input
            type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
            maxLength={30} placeholder="1-800-555-0123"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Address (optional)</label>
          <input
            type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            maxLength={500} placeholder="123 Main St, City, ST 12345"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Eligibility summary (optional)</label>
          <input
            type="text" value={eligibility} onChange={(e) => setEligibility(e.target.value)}
            maxLength={1000} placeholder="Who qualifies for this program?"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <Button type="submit" disabled={submitting || categoryId === 0} className="w-full">
          {submitting ? "Submitting..." : "Submit for review"}
        </Button>
      </form>
    </Card>
  );
}
