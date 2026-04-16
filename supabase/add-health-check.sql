-- Migration: add health-check tracking columns to resources
--
-- Run this in the Supabase SQL Editor before using scripts/health-check.ts

-- Add 'potentially_closed' to the link_status enum
ALTER TYPE link_status ADD VALUE IF NOT EXISTS 'potentially_closed';

-- Track consecutive fetch failures and when we last checked
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- Index so the crawler can efficiently page through unchecked / oldest-checked rows
CREATE INDEX IF NOT EXISTS idx_resources_last_checked
  ON resources (last_checked_at ASC NULLS FIRST);
