import type {
  ResourceScope,
  PostCategory,
  ReportCategory,
  UserRole,
  UserStatus,
  EventCategory,
  EventStatus,
  EventRecurrence,
} from "@/lib/constants";

export interface LocationInfo {
  zip: string;
  city: string;
  county: string;
  state: string;
}

// ---- User / Profile ----

export interface UserProfile {
  id: string;
  display_name: string;
  zip_code: string;
  role: UserRole;
  status: UserStatus;
  bio: string | null;
  radius: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfilePublic {
  id: string;
  display_name: string;
  role: UserRole;
  city: string;
  state_code: string;
}

// ---- Resources ----

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
  eligibility_summary: string | null;
  income_limit_notes: string | null;
  hours: string | null;
  languages: string | null;
  net_score: number;
  verified_at: string | null;
  user_vote?: 1 | -1 | null;  // current user's vote on this resource
  distance_miles: number | null;  // null for state/national scope
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

// ---- Resource Comments (nested threads) ----

export interface ResourceComment {
  id: string;
  resource_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  depth: number;
  upvotes: number;
  flags: number;
  status: "visible" | "flagged" | "removed";
  created_at: string;
  updated_at: string;
  author_name: string;
  author_city: string;
  author_state: string;
  replies?: ResourceComment[];  // populated client-side from flat list
}

// ---- Community Posts ----

export interface FeedPost {
  id: string;
  body: string;
  title: string | null;
  category: PostCategory;
  upvotes: number;
  downvotes: number;
  flags: number;
  is_pinned: boolean;
  user_id: string | null;
  author_name: string | null;
  author_city: string | null;
  author_state: string | null;
  created_at: string;
  expires_at: string | null;
  user_vote?: 1 | -1 | null;
}

export interface FeedResponse {
  posts: FeedPost[];
  total: number;
  page: number;
  totalPages: number;
}

// ---- Events ----

export interface CalendarEvent {
  id: string;
  user_id: string;
  zip_code: string;
  title: string;
  description: string;
  location: string | null;
  category: EventCategory;
  event_date: string;
  end_date: string | null;
  recurrence: EventRecurrence | null;
  status: EventStatus;
  author_name: string;
  event_city: string;
  event_state: string;
  event_county: string;
  approved_at: string | null;
  created_at: string;
}

export interface EventsResponse {
  events: CalendarEvent[];
  total: number;
  page: number;
  totalPages: number;
}

// ---- Reports ----

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

// ---- Common ----

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}
