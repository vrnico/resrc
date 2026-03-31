import { ExternalLink, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ResourceResult } from "@/types/index";

interface ResourceCardProps {
  resource: ResourceResult;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  const verifiedDate = resource.verifiedAt
    ? new Date(resource.verifiedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card
      className="focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
      tabIndex={0}
    >
      <div className="space-y-2">
        {/* Name + Badge */}
        <div className="flex flex-wrap items-start gap-2">
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold text-lg inline-flex items-center gap-1 focus:outline-none"
          >
            {resource.name}
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
          </a>
          <Badge scope={resource.scope} />
        </div>

        {/* Description */}
        <p className="text-foreground text-sm leading-relaxed">
          {resource.description}
        </p>

        {/* Eligibility */}
        {resource.eligibilitySummary && (
          <p className="text-muted text-sm">
            <span className="font-medium">Eligibility:</span>{" "}
            {resource.eligibilitySummary}
          </p>
        )}

        {/* Contact info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {resource.phone && (
            <a
              href={`tel:${resource.phone}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              {resource.phone}
            </a>
          )}
          {resource.address && (
            <span className="inline-flex items-center gap-1 text-muted">
              <MapPin className="w-4 h-4" aria-hidden="true" />
              {resource.address}
            </span>
          )}
        </div>

        {/* Verified date */}
        {verifiedDate && (
          <p className="text-xs text-muted pt-1">Verified {verifiedDate}</p>
        )}
      </div>
    </Card>
  );
}
