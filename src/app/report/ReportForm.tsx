"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABELS, SEVERITY_LABELS } from "@/lib/constants";
import type { ReportCategory } from "@/lib/constants";
import { CheckCircle2 } from "lucide-react";

interface ReportFormProps {
  initialZip: string;
}

export function ReportForm({ initialZip }: ReportFormProps) {
  const [zip, setZip] = useState(initialZip);
  const [category, setCategory] = useState<ReportCategory>("unsafe_housing");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState(1);
  const [locationDetails, setLocationDetails] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip,
          category,
          body,
          severity,
          locationDetails: locationDetails || undefined,
          contactInfo: contactInfo || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="text-center py-12">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Report Submitted</h2>
        <p className="text-sm text-muted mt-2">
          Your report has been submitted anonymously. Thank you for helping your community.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Zip Code</label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            required
            pattern="\d{5}"
            inputMode="numeric"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            {REPORT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {REPORT_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Severity
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSeverity(level)}
                className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                  severity === level
                    ? level <= 2
                      ? "bg-yellow-100 text-yellow-800 ring-2 ring-yellow-400"
                      : level <= 3
                      ? "bg-orange-100 text-orange-800 ring-2 ring-orange-400"
                      : "bg-red-100 text-red-800 ring-2 ring-red-400"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1">{SEVERITY_LABELS[severity]}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Description
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={10}
            maxLength={5000}
            rows={5}
            placeholder="Describe the issue in detail..."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted mt-1">{body.length}/5000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Location Details (optional)
          </label>
          <input
            type="text"
            value={locationDetails}
            onChange={(e) => setLocationDetails(e.target.value)}
            maxLength={500}
            placeholder="e.g., intersection, building name, neighborhood"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Contact Info (optional, stored securely)
          </label>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            maxLength={500}
            placeholder="Email or phone (only shared with local organizations if needed)"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted mt-1">
            Your identity is never publicly shared. Contact info is only used to follow up if you choose to provide it.
          </p>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Anonymous Report"}
        </button>
      </form>
    </Card>
  );
}
