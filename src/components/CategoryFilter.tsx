"use client";

import {
  UtensilsCrossed,
  Home,
  Briefcase,
  HeartPulse,
  Bus,
  Zap,
  Scale,
  GraduationCap,
  Baby,
  Shield,
  AlertTriangle,
  Users,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  food: UtensilsCrossed,
  housing: Home,
  employment: Briefcase,
  healthcare: HeartPulse,
  transportation: Bus,
  utilities: Zap,
  legal: Scale,
  education: GraduationCap,
  family: Baby,
  veterans: Shield,
  crisis: AlertTriangle,
  community: Users,
};

export interface CategoryOption {
  slug: string;
  name: string;
}

interface CategoryFilterProps {
  categories: CategoryOption[];
  selected: string;
  onSelect: (slug: string) => void;
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps) {
  const allCategories: CategoryOption[] = [
    { slug: "all", name: "All" },
    ...categories,
  ];

  return (
    <nav aria-label="Category filter">
      <div className="flex flex-wrap gap-2">
        {allCategories.map((cat) => {
          const isActive = selected === cat.slug;
          const Icon = cat.slug === "all" ? LayoutGrid : iconMap[cat.slug];

          return (
            <button
              key={cat.slug}
              onClick={() => onSelect(cat.slug)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-muted-bg text-foreground hover:bg-gray-200"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
              {cat.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
