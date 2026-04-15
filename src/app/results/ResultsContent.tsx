"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ResourceCard } from "@/components/ResourceCard";
import { CategoryFilter, type CategoryOption } from "@/components/CategoryFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ResourcesResponse, ResourceResult } from "@/types/index";

type SortMode = "relevant" | "top" | "new" | "controversial";

const RADIUS_PRESETS = [10, 25, 50, 100] as const;
const DEFAULT_RADIUS = 25;

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
      return sorted.sort((a, b) => Math.abs(a.net_score) - Math.abs(b.net_score));
    case "relevant":
    default:
      return sorted;
  }
}

interface ResultsContentProps {
  zip: string;
}

export function ResultsContent({ zip }: ResultsContentProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevant");
  const [data, setData] = useState<ResourcesResponse | null>(null);
  const [allResults, setAllResults] = useState<ResourceResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [inputValue, setInputValue] = useState(String(DEFAULT_RADIUS));
  const [showNearby, setShowNearby] = useState(true);
  const [showStatewide, setShowStatewide] = useState(true);
  const [showNational, setShowNational] = useState(true);
  const isLoggedInRef = useRef(false);
  const patchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed radius from profile on mount (non-blocking)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (!profile) return;
        isLoggedInRef.current = true;
        if (typeof profile.radius === "number") {
          setRadius(profile.radius);
          setInputValue(String(profile.radius));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (patchDebounceRef.current) clearTimeout(patchDebounceRef.current);
    };
  }, []);

  // Full reset + fetch page 1 when zip, radius, or category changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    setAllResults([]);
    setPage(1);

    const params = buildParams(zip, radius, selectedCategory, 1);
    fetch(`/api/resources?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Error ${res.status}`);
        }
        return res.json();
      })
      .then((json: ResourcesResponse) => {
        setData(json);
        setAllResults(json.results);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [zip, radius, selectedCategory]);

  function buildParams(z: string, r: number, cat: string, p: number) {
    const params = new URLSearchParams({
      zip: z,
      radius: String(r),
      page: String(p),
    });
    if (cat !== "all") params.set("category", cat);
    return params.toString();
  }

  function loadMore() {
    if (!data || page >= data.totalPages || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetch(`/api/resources?${buildParams(zip, radius, selectedCategory, nextPage)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ResourcesResponse | null) => {
        if (!json) return;
        setAllResults((prev) => [...prev, ...json.results]);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  function persistRadius(value: number) {
    if (!isLoggedInRef.current) return;
    if (patchDebounceRef.current) clearTimeout(patchDebounceRef.current);
    patchDebounceRef.current = setTimeout(() => {
      fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radius: value }),
      }).catch(() => {});
    }, 500);
  }

  function applyRadius(value: number) {
    const clamped = Math.min(200, Math.max(1, value));
    setRadius(clamped);
    setInputValue(String(clamped));
    persistRadius(clamped);
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val !== "custom") applyRadius(Number(val));
  }

  function commitInput() {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      applyRadius(parsed);
    } else {
      setInputValue(String(radius));
    }
  }

  // Split accumulated results into three sections:
  // - nearby: has a distance (county/city/zip_specific with county data)
  // - statewide: no distance, not national (state + city/county without county data)
  // - national: national scope
  const nearbyResults = useMemo(
    () => allResults.filter((r) => r.distance_miles != null),
    [allResults]
  );
  const stateResults = useMemo(
    () => allResults.filter((r) => r.distance_miles == null && r.scope !== "national"),
    [allResults]
  );
  const nationalResults = useMemo(
    () => allResults.filter((r) => r.scope === "national"),
    [allResults]
  );

  const sortedNearby = useMemo(() => sortResources(nearbyResults, sortMode), [nearbyResults, sortMode]);
  const sortedState = useMemo(() => sortResources(stateResults, sortMode), [stateResults, sortMode]);
  const sortedNational = useMemo(() => sortResources(nationalResults, sortMode), [nationalResults, sortMode]);

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

  const { location, total, categories } = data;
  const hasMore = page < data.totalPages;

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

  const selectValue = (RADIUS_PRESETS as readonly number[]).includes(radius)
    ? String(radius)
    : "custom";

  return (
    <>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">
        Showing resources for {zip} &mdash; {location.city}, {location.state}
      </h1>

      <div className="mt-4">
        <CategoryFilter
          categories={categoryOptions}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      {/* Count + sort row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {allResults.length} of {total}{" "}
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

      {/* Section filter chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            { key: "nearby",    label: "Nearby",    active: showNearby,    toggle: () => setShowNearby((v) => !v),    color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
            { key: "statewide", label: "Statewide", active: showStatewide, toggle: () => setShowStatewide((v) => !v), color: "bg-blue-50 border-blue-200 text-blue-700" },
            { key: "national",  label: "National",  active: showNational,  toggle: () => setShowNational((v) => !v),  color: "bg-gray-100 border-gray-300 text-gray-700" },
          ] as const
        ).map(({ key, label, active, toggle, color }) => (
          <button
            key={key}
            onClick={toggle}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              active ? color : "border-border text-muted hover:text-foreground hover:bg-muted-bg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Nearby section */}
      {showNearby && (
      <div className="mt-6">
        <div className="flex items-center gap-1.5 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Nearby
          </h2>
          <span className="text-xs text-muted">(within</span>
          <div className="flex items-center border border-border rounded overflow-hidden">
            <select
              value={selectValue}
              onChange={handleSelectChange}
              className="py-0.5 pl-1.5 pr-0.5 border-none outline-none bg-transparent text-xs text-foreground cursor-pointer"
              aria-label="Radius preset"
            >
              {RADIUS_PRESETS.map((p) => (
                <option key={p} value={String(p)}>{p} mi</option>
              ))}
              <option value="custom">Custom</option>
            </select>
            <div className="w-px h-4 bg-border mx-0.5" />
            <input
              type="number"
              min={1}
              max={200}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={commitInput}
              onKeyDown={(e) => e.key === "Enter" && commitInput()}
              className="w-12 px-1.5 py-0.5 border-none outline-none bg-transparent text-xs text-foreground"
              aria-label="Custom radius in miles"
            />
          </div>
          <span className="text-xs text-muted">mi)</span>
        </div>

        {sortedNearby.length > 0 ? (
          <div className="space-y-4">
            {sortedNearby.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted">
            No resources found within {radius} mi.{" "}
            {radius < 200 && (
              <button
                onClick={() => applyRadius(Math.min(200, radius * 2))}
                className="text-primary hover:underline"
              >
                Try {Math.min(200, radius * 2)} mi?
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* Statewide section */}
      {showStatewide && sortedState.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            Statewide
          </h2>
          <div className="space-y-4">
            {sortedState.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      )}

      {/* National section */}
      {showNational && sortedNational.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            National
          </h2>
          <div className="space-y-4">
            {sortedNational.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 text-sm font-medium border border-border rounded-lg text-foreground hover:bg-muted-bg transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : `Load more (${total - allResults.length} remaining)`}
          </button>
        </div>
      )}
    </>
  );
}
