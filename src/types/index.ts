import type { ResourceScope, PostCategory, ReportCategory, AmbassadorStatus, AmbassadorRole, PostType } from "@/lib/constants";

export interface LocationInfo {
  zip: string;
  city: string;
  county: string;
  state: string;
}

export interface ResourceResult {
  id: string;
  name: string;
  description: string;
  category: {
    slug: string;
    name: string;
    icon: string;
  };
  subcategory: string | null;
  scope: ResourceScope;
  url: string;
  phone: string | null;
  address: string | null;
  eligibilitySummary: string | null;
  incomeLimitNotes: string | null;
  hours: string | null;
  languages: string | null;
  verifiedAt: string | null;
}

export interface ResourcesResponse {
  location: LocationInfo;
  results: ResourceResult[];
  total: number;
  page: number;
  totalPages: number;
  categories: CategoryCount[];
}

export interface CategoryCount {
  slug: string;
  name: string;
  icon: string;
  count: number;
}

export interface AmbassadorPublic {
  id: string;
  displayName: string;
  bio: string | null;
  role: AmbassadorRole;
  verifiedAt: string | null;
}

export interface AmbassadorProfile extends AmbassadorPublic {
  email: string;
  zipCode: string;
  radius: number;
  status: AmbassadorStatus;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  body: string;
  title: string | null;
  category: PostCategory;
  postType: PostType;
  upvotes: number;
  flags: number;
  isPinned: boolean;
  ambassador: AmbassadorPublic | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface FeedResponse {
  posts: FeedPost[];
  total: number;
  page: number;
  totalPages: number;
  ambassadorCount: number;
}

export interface ReportSubmission {
  zip: string;
  category: ReportCategory;
  body: string;
  severity: number;
  locationDetails?: string;
  contactInfo?: string;
}

export interface ReportAggregation {
  category: ReportCategory;
  count: number;
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}
