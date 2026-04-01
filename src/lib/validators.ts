import { z } from "zod";
import {
  POST_CATEGORIES,
  REPORT_CATEGORIES,
  EVENT_CATEGORIES,
  EVENT_RECURRENCES,
  MAX_POST_LENGTH,
  MAX_REPORT_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_EVENT_DESCRIPTION_LENGTH,
} from "./constants";

// ---- Auth ----

export const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(50),
  zipCode: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  bio: z.string().max(500).optional(),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---- Resources ----

export const ZipQuerySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ResourceVoteSchema = z.object({
  vote: z.union([z.literal(1), z.literal(-1)]),
});

// ---- Comments ----

export const CommentCreateSchema = z.object({
  body: z.string().min(1).max(MAX_COMMENT_LENGTH),
  parentId: z.string().uuid().optional(),
});

export const CommentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---- Community Posts ----

export const FeedPostSchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  title: z.string().max(200).optional(),
  body: z
    .string()
    .min(1, "Post cannot be empty")
    .max(MAX_POST_LENGTH, `Post cannot exceed ${MAX_POST_LENGTH} characters`),
  category: z.enum(POST_CATEGORIES),
});

export const FeedQuerySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const PostVoteSchema = z.object({
  vote: z.union([z.literal(1), z.literal(-1)]),
});

// ---- Events ----

export const EventCreateSchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  title: z.string().min(1).max(200),
  description: z
    .string()
    .min(10)
    .max(MAX_EVENT_DESCRIPTION_LENGTH),
  location: z.string().max(500).optional(),
  category: z.enum(EVENT_CATEGORIES),
  eventDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  recurrence: z.enum(EVENT_RECURRENCES).optional(),
});

export const EventQuerySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  category: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- Reports ----

export const ReportSchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  category: z.enum(REPORT_CATEGORIES),
  body: z
    .string()
    .min(10, "Please provide more detail")
    .max(MAX_REPORT_LENGTH, `Report cannot exceed ${MAX_REPORT_LENGTH} characters`),
  severity: z.coerce.number().int().min(1).max(5),
  locationDetails: z.string().max(500).optional(),
  contactInfo: z.string().max(500).optional(),
});

// ---- Admin ----

export const UpdateProfileRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "moderator", "social_worker", "admin"]),
});

export const UpdateProfileStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "pending", "suspended"]),
});

export const ModerateEventSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});
