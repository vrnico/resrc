"use client";

import { useState, useEffect } from "react";
import { ResourceCard } from "@/components/ResourceCard";
import { CategoryFilter, type CategoryOption } from "@/components/CategoryFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ResourcesResponse, ResourceResult } from "@/types/index";

interface ResultsContentProps {
  zip: string;
}

export function ResultsContent({ zip }: ResultsContentProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
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
  useEffect(() => {
    if (!data || selectedCategory === "all") return;

    // Don't re-fetch if we already have the data - filter client-side for the initial load
    // but fetch from API for category filtering to get proper pagination
    fetch(`/api/resources?zip=${zip}&category=${selectedCategory}`)
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
      .catch(() => {
        // Silently fail category filter - user still sees unfiltered results
      });
  }, [selectedCategory, zip]);

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

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    slug: c.slug,
    name: `${c.name} (${c.count})`,
  }));

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
          onSelect={setSelectedCategory}
        />
      </div>

      {/* Results count */}
      <p className="mt-4 text-sm text-muted">
        {results.length} of {total}{" "}
        {total === 1 ? "resource" : "resources"}
        {selectedCategory !== "all" ? ` in ${selectedCategory}` : ""}
      </p>

      {/* Resource list */}
      {results.length > 0 ? (
        <div className="mt-4 space-y-4">
          {results.map((resource) => (
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
