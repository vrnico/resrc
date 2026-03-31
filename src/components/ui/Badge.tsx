import { SCOPE_LABELS, SCOPE_COLORS, type ResourceScope } from "@/lib/constants";

interface BadgeProps {
  scope: ResourceScope;
  className?: string;
}

export function Badge({ scope, className = "" }: BadgeProps) {
  const label = SCOPE_LABELS[scope] ?? scope;
  const colors = SCOPE_COLORS[scope] ?? "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors} ${className}`}
    >
      {label}
    </span>
  );
}
