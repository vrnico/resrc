export const RESOURCE_SCOPES = [
  "national",
  "state",
  "county",
  "city",
  "zip_specific",
] as const;

export type ResourceScope = (typeof RESOURCE_SCOPES)[number];

export const POST_CATEGORIES = ["tip", "question", "alert", "offer", "resource", "event"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const REPORT_CATEGORIES = [
  "unsafe_housing",
  "employer_abuse",
  "food_safety",
  "utility_issue",
  "discrimination",
  "benefits_access",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  unsafe_housing: "Unsafe Housing Conditions",
  employer_abuse: "Employer Violations",
  food_safety: "Food Safety Concerns",
  utility_issue: "Utility Shutoff / Billing Abuse",
  discrimination: "Discrimination",
  benefits_access: "Benefits Access Barriers",
  other: "Other",
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: "Minor concern",
  2: "Moderate issue",
  3: "Significant problem",
  4: "Serious situation",
  5: "Immediate danger",
};

export const SCOPE_LABELS: Record<ResourceScope, string> = {
  national: "National",
  state: "State",
  county: "County",
  city: "City",
  zip_specific: "Local",
};

export const SCOPE_COLORS: Record<ResourceScope, string> = {
  national: "bg-gray-100 text-gray-700",
  state: "bg-blue-100 text-blue-700",
  county: "bg-indigo-100 text-indigo-700",
  city: "bg-green-100 text-green-700",
  zip_specific: "bg-emerald-100 text-emerald-700",
};

export const AMBASSADOR_STATUSES = ["pending", "approved", "suspended"] as const;
export type AmbassadorStatus = (typeof AMBASSADOR_STATUSES)[number];

export const AMBASSADOR_ROLES = ["ambassador", "moderator"] as const;
export type AmbassadorRole = (typeof AMBASSADOR_ROLES)[number];

export const POST_TYPES = ["community", "ambassador"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  tip: "Tip",
  question: "Question",
  alert: "Alert",
  offer: "Offer",
  resource: "Resource",
  event: "Event",
};

export const MAX_POST_LENGTH = 1000;
export const MAX_REPORT_LENGTH = 5000;
export const POSTS_PER_PAGE = 25;
export const RESOURCES_PER_PAGE = 20;
export const FLAG_THRESHOLD = 3;
export const POST_EXPIRY_DAYS = 90;
