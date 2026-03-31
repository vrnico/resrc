import { z } from "zod";
import {
  POST_CATEGORIES,
  REPORT_CATEGORIES,
  MAX_POST_LENGTH,
  MAX_REPORT_LENGTH,
} from "./constants";

export const AmbassadorRegisterSchema = z.object({
  displayName: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  bio: z.string().max(500).optional(),
  zipCode: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  radius: z.coerce.number().int().min(1).max(50).default(10),
});

export const AmbassadorLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const AmbassadorPostSchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  title: z.string().min(1).max(200),
  body: z
    .string()
    .min(1, "Post cannot be empty")
    .max(2000, "Post cannot exceed 2000 characters"),
  category: z.enum(POST_CATEGORIES),
  expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
});

export const ZipQuerySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const FeedPostSchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  body: z
    .string()
    .min(1, "Post cannot be empty")
    .max(MAX_POST_LENGTH, `Post cannot exceed ${MAX_POST_LENGTH} characters`),
  category: z.enum(POST_CATEGORIES),
});

export const ReportSchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  category: z.enum(REPORT_CATEGORIES),
  body: z
    .string()
    .min(10, "Please provide more detail")
    .max(
      MAX_REPORT_LENGTH,
      `Report cannot exceed ${MAX_REPORT_LENGTH} characters`
    ),
  severity: z.coerce.number().int().min(1).max(5),
  locationDetails: z.string().max(500).optional(),
  contactInfo: z.string().max(500).optional(),
});

export const FeedQuerySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "Must be a 5-digit US zip code"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
