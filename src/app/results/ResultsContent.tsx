"use client";

import { useState, useEffect, useMemo } from "react";
import { ResourceCard } from "@/components/ResourceCard";
import { CategoryFilter, type CategoryOption } from "@/components/CategoryFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ResourcesResponse, ResourceResult } from "@/types/index";

type SortMode = "relevant" | "top" | "new" | "controversial";

function sortResources(resources: ResourceResult[], mode: SortMode): ResourceResult[] {
  const sorted = [...resources];
  switch (mode) {
    case "top":
      return sorted.sort((a, b) => b.net_score - a.net_score);
    case "new":
      return sorted.sort((a, b) => {
        const dateA = a.verified_at ? new Date(a.verified_at).getTime() : 0;
        const dateB = b.verified_at ? new Date(b.verified_at).getTime() : 0;
        return dateB - dateA;
      });
    case "controversial":
      // Resources with scores closest to 0 but with votes (activity) first
      // Since we only have net_score, treat low absolute score as controversial
      return sorted.sort((a, b) => Math.abs(a.net_score) - Math.abs(b.net_score));
    case "relevant":
    default:
      return sorted; // API default order (local scope first, then score)
  }
}

interface ResultsContentProps {
  zip: string;
}

export function ResultsContent({ zip }: ResultsContentProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevant");
  const [data, setData] = useState<ResourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    setSelectedCategory("all");

    fetch(`/api/resources?zip=${zip}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Error ${res.status}`);
        }
        return res.json();
      })
      .then((json: ResourcesResponse) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [zip]);

  // Fetch filtered results when category changes
  function fetchCategory(cat: string) {
    if (!data || cat === "all") return;

    fetch(`/api/resources?zip=${zip}&category=${cat}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to filter");
        return res.json();
      })
      .then((json: ResourcesResponse) => {
        setData((prev) =>
          prev
            ? { ...json, categories: prev.categories }
            : json
        );
      })
      .catch(() => {});
  }

  function handleCategorySelect(cat: string) {
    setSelectedCategory(cat);
    if (cat !== "all") {
      fetchCategory(cat);
    } else if (data) {
      // Reset to full results
      fetch(`/api/resources?zip=${zip}`)
        .then((res) => res.ok ? res.json() : null)
        .then((json) => { if (json) setData(json); })
        .catch(() => {});
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 text-center py-12">
        <p className="text-lg text-error font-medium">{error}</p>
        <p className="mt-2 text-sm text-muted">
          Try a different zip code or check back later.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { location, results, total, categories } = data;

  const sortedResults = useMemo(
    () => sortResources(results, sortMode),
    [results, sortMode]
  );

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    slug: c.slug,
    name: `${c.name} (${c.count})`,
  }));

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "relevant", label: "Relevant" },
    { value: "top", label: "Top" },
    { value: "new", label: "New" },
    { value: "controversial", label: "Controversial" },
  ];

  return (
    <>
      {/* Location header */}
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">
        Showing resources for {zip} &mdash; {location.city}, {location.state}
      </h1>

      {/* Category filter */}
      <div className="mt-4">
        <CategoryFilter
          categories={categoryOptions}
          selected={selectedCategory}
          onSelect={handleCategorySelect}
        />
      </div>

      {/* Sort + count row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {results.length} of {total}{" "}
          {total === 1 ? "resource" : "resources"}
          {selectedCategory !== "all" ? ` in ${selectedCategory}` : ""}
        </p>
        <div className="flex items-center gap-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortMode(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                sortMode === opt.value
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground hover:bg-muted-bg"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resource list */}
      {sortedResults.length > 0 ? (
        <div className="mt-4 space-y-4">
          {sortedResults.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <div className="mt-8 text-center py-12">
          <p className="text-lg text-muted">
            No resources found for this category.
          </p>
          <p className="mt-1 text-sm text-muted">
            Try selecting a different category or searching a nearby zip code.
          </p>
        </div>
      )}
    </>
  );
}
