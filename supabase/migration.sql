-- ============================================================
-- RESRC / LIFELINE — Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- 1. CORE LOOKUP TABLES
-- ============================================================

-- Zip codes (geographic lookup)
CREATE TABLE zip_codes (
  zip         TEXT PRIMARY KEY,
  city        TEXT NOT NULL,
  state_code  TEXT NOT NULL,
  county      TEXT NOT NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  timezone    TEXT
);

CREATE INDEX idx_zip_codes_state ON zip_codes(state_code);
CREATE INDEX idx_zip_codes_county ON zip_codes(state_code, county);
CREATE INDEX idx_zip_codes_city ON zip_codes(state_code, city);

-- Resource categories
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);

-- ============================================================
-- 2. USER PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'social_worker', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'pending', 'suspended');

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  zip_code      TEXT NOT NULL REFERENCES zip_codes(zip),
  role          user_role NOT NULL DEFAULT 'user',
  status        user_status NOT NULL DEFAULT 'active',
  bio           TEXT,
  radius        INT NOT NULL DEFAULT 10,  -- miles
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_zip ON profiles(zip_code);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, zip_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Anonymous'),
    COALESCE(NEW.raw_user_meta_data->>'zip_code', '00000')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. RESOURCES
-- ============================================================

CREATE TYPE resource_scope AS ENUM ('national', 'state', 'county', 'city', 'zip_specific');
CREATE TYPE link_status AS ENUM ('ok', 'broken', 'unknown');

CREATE TABLE resources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  category_id         INT NOT NULL REFERENCES categories(id),
  subcategory         TEXT,
  scope               resource_scope NOT NULL,
  url                 TEXT NOT NULL,
  phone               TEXT,
  address             TEXT,
  eligibility_summary TEXT,
  income_limit_notes  TEXT,
  hours               TEXT,
  languages           TEXT,  -- comma-separated
  state_code          TEXT,
  county              TEXT,
  link_status         link_status NOT NULL DEFAULT 'ok',
  net_score           INT NOT NULL DEFAULT 0,  -- aggregated vote score
  verified_at         TIMESTAMPTZ,
  verified_by         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resources_category ON resources(category_id);
CREATE INDEX idx_resources_scope ON resources(scope);
CREATE INDEX idx_resources_state ON resources(state_code);
CREATE INDEX idx_resources_county ON resources(state_code, county);
CREATE INDEX idx_resources_score ON resources(net_score DESC);

CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Join table for zip-specific resources
CREATE TABLE resource_zip_codes (
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  zip_code    TEXT NOT NULL REFERENCES zip_codes(zip),
  PRIMARY KEY (resource_id, zip_code)
);

CREATE INDEX idx_resource_zips_zip ON resource_zip_codes(zip_code);

-- ============================================================
-- 4. RESOURCE VOTES (Reddit-style up/down)
-- ============================================================

CREATE TABLE resource_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  vote        SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

CREATE INDEX idx_resource_votes_resource ON resource_votes(resource_id);
CREATE INDEX idx_resource_votes_user ON resource_votes(user_id);

-- Trigger to keep resources.net_score in sync
CREATE OR REPLACE FUNCTION update_resource_net_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE resources SET net_score = net_score + NEW.vote WHERE id = NEW.resource_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE resources SET net_score = net_score - OLD.vote + NEW.vote WHERE id = NEW.resource_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE resources SET net_score = net_score - OLD.vote WHERE id = OLD.resource_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER resource_votes_score
  AFTER INSERT OR UPDATE OR DELETE ON resource_votes
  FOR EACH ROW EXECUTE FUNCTION update_resource_net_score();

-- ============================================================
-- 5. RESOURCE COMMENTS (Reddit-style nested threads)
-- ============================================================

CREATE TYPE comment_status AS ENUM ('visible', 'flagged', 'removed');

CREATE TABLE resource_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES resource_comments(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) <= 2000),
  depth       INT NOT NULL DEFAULT 0 CHECK (depth <= 5),  -- max nesting depth
  upvotes     INT NOT NULL DEFAULT 0,
  flags       INT NOT NULL DEFAULT 0,
  status      comment_status NOT NULL DEFAULT 'visible',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_resource ON resource_comments(resource_id);
CREATE INDEX idx_comments_parent ON resource_comments(parent_id);
CREATE INDEX idx_comments_user ON resource_comments(user_id);
CREATE INDEX idx_comments_status ON resource_comments(status);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON resource_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-set depth from parent
CREATE OR REPLACE FUNCTION set_comment_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT depth + 1 INTO NEW.depth FROM resource_comments WHERE id = NEW.parent_id;
    IF NEW.depth > 5 THEN
      RAISE EXCEPTION 'Maximum comment nesting depth (5) exceeded';
    END IF;
  ELSE
    NEW.depth := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_depth_trigger
  BEFORE INSERT ON resource_comments
  FOR EACH ROW EXECUTE FUNCTION set_comment_depth();

-- ============================================================
-- 6. COMMUNITY POSTS (updated from original schema)
-- ============================================================

CREATE TYPE post_category AS ENUM ('tip', 'question', 'alert', 'offer', 'resource', 'event');
CREATE TYPE post_status AS ENUM ('visible', 'flagged', 'removed', 'pending_review');

CREATE TABLE community_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code          TEXT NOT NULL REFERENCES zip_codes(zip),
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- nullable for legacy anonymous posts
  body              TEXT NOT NULL CHECK (char_length(body) <= 2000),
  title             TEXT CHECK (char_length(title) <= 200),
  category          post_category NOT NULL,
  upvotes           INT NOT NULL DEFAULT 0,
  downvotes         INT NOT NULL DEFAULT 0,
  flags             INT NOT NULL DEFAULT 0,
  status            post_status NOT NULL DEFAULT 'visible',
  is_pinned         BOOLEAN NOT NULL DEFAULT false,
  fingerprint_hash  TEXT,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_zip ON community_posts(zip_code);
CREATE INDEX idx_posts_status ON community_posts(status);
CREATE INDEX idx_posts_user ON community_posts(user_id);
CREATE INDEX idx_posts_category ON community_posts(category);
CREATE INDEX idx_posts_created ON community_posts(created_at DESC);

-- Post votes (separate table for Reddit-style voting)
CREATE TABLE post_votes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id   UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  vote      SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_post_votes_post ON post_votes(post_id);

-- Trigger to keep post vote counts in sync
CREATE OR REPLACE FUNCTION update_post_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.vote = 1 THEN
      UPDATE community_posts SET upvotes = upvotes - 1 WHERE id = OLD.post_id;
    ELSE
      UPDATE community_posts SET downvotes = downvotes - 1 WHERE id = OLD.post_id;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.vote = 1 THEN
      UPDATE community_posts SET upvotes = upvotes + 1 WHERE id = NEW.post_id;
    ELSE
      UPDATE community_posts SET downvotes = downvotes + 1 WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote = 1 THEN
      UPDATE community_posts SET upvotes = upvotes - 1 WHERE id = OLD.post_id;
    ELSE
      UPDATE community_posts SET downvotes = downvotes - 1 WHERE id = OLD.post_id;
    END IF;
    IF NEW.vote = 1 THEN
      UPDATE community_posts SET upvotes = upvotes + 1 WHERE id = NEW.post_id;
    ELSE
      UPDATE community_posts SET downvotes = downvotes + 1 WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER post_votes_counts
  AFTER INSERT OR UPDATE OR DELETE ON post_votes
  FOR EACH ROW EXECUTE FUNCTION update_post_vote_counts();

-- ============================================================
-- 7. EVENTS (Regional calendar / bulletin board)
-- ============================================================

CREATE TYPE event_category AS ENUM (
  'clothing_swap', 'free_food', 'mutual_aid', 'workshop',
  'meetup', 'donation_drive', 'job_fair', 'health_screening',
  'legal_clinic', 'other'
);
CREATE TYPE event_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE event_recurrence AS ENUM ('weekly', 'biweekly', 'monthly');

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  zip_code    TEXT NOT NULL REFERENCES zip_codes(zip),
  title       TEXT NOT NULL CHECK (char_length(title) <= 200),
  description TEXT NOT NULL CHECK (char_length(description) <= 5000),
  location    TEXT CHECK (char_length(location) <= 500),
  category    event_category NOT NULL,
  event_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ,
  recurrence  event_recurrence,
  status      event_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_zip ON events(zip_code);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_user ON events(user_id);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. REPORTS (mostly unchanged, now linkable to user)
-- ============================================================

CREATE TYPE report_category AS ENUM (
  'unsafe_housing', 'employer_abuse', 'food_safety',
  'utility_issue', 'discrimination', 'benefits_access', 'other'
);
CREATE TYPE report_status AS ENUM ('new', 'reviewed', 'routed', 'resolved');

CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code          TEXT NOT NULL REFERENCES zip_codes(zip),
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- nullable for anonymous
  category          report_category NOT NULL,
  body              TEXT NOT NULL CHECK (char_length(body) <= 5000),
  severity          INT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  location_details  TEXT CHECK (char_length(location_details) <= 500),
  contact_encrypted TEXT CHECK (char_length(contact_encrypted) <= 500),
  status            report_status NOT NULL DEFAULT 'new',
  admin_notes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_zip ON reports(zip_code);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_category ON reports(category);

-- ============================================================
-- 9. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is current user admin or moderator?
CREATE OR REPLACE FUNCTION is_moderator_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('moderator', 'social_worker', 'admin')
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- PROFILES ----
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())  -- can't self-promote
  );

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE USING (is_admin());

-- ---- ZIP CODES ----
ALTER TABLE zip_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zip codes are readable by everyone"
  ON zip_codes FOR SELECT USING (true);

CREATE POLICY "Admins can manage zip codes"
  ON zip_codes FOR ALL USING (is_admin());

-- ---- CATEGORIES ----
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are readable by everyone"
  ON categories FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL USING (is_admin());

-- ---- RESOURCES ----
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resources are readable by everyone"
  ON resources FOR SELECT USING (true);

CREATE POLICY "Moderators+ can manage resources"
  ON resources FOR ALL USING (is_moderator_or_above());

-- ---- RESOURCE ZIP CODES ----
ALTER TABLE resource_zip_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resource zip codes are readable by everyone"
  ON resource_zip_codes FOR SELECT USING (true);

CREATE POLICY "Moderators+ can manage resource zip codes"
  ON resource_zip_codes FOR ALL USING (is_moderator_or_above());

-- ---- RESOURCE VOTES ----
ALTER TABLE resource_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are readable by everyone"
  ON resource_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote"
  ON resource_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change own vote"
  ON resource_votes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote"
  ON resource_votes FOR DELETE USING (auth.uid() = user_id);

-- ---- RESOURCE COMMENTS ----
ALTER TABLE resource_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible comments are readable by everyone"
  ON resource_comments FOR SELECT USING (status = 'visible' OR auth.uid() = user_id OR is_moderator_or_above());

CREATE POLICY "Authenticated users can comment"
  ON resource_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit own comments"
  ON resource_comments FOR UPDATE USING (auth.uid() = user_id OR is_moderator_or_above());

CREATE POLICY "Moderators+ can delete comments"
  ON resource_comments FOR DELETE USING (is_moderator_or_above());

-- ---- COMMUNITY POSTS ----
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible posts are readable by everyone"
  ON community_posts FOR SELECT USING (status = 'visible' OR auth.uid() = user_id OR is_moderator_or_above());

CREATE POLICY "Authenticated users can create posts"
  ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit own posts, moderators can edit any"
  ON community_posts FOR UPDATE USING (auth.uid() = user_id OR is_moderator_or_above());

CREATE POLICY "Moderators+ can delete posts"
  ON community_posts FOR DELETE USING (is_moderator_or_above());

-- ---- POST VOTES ----
ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post votes are readable by everyone"
  ON post_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote on posts"
  ON post_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change own post vote"
  ON post_votes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove own post vote"
  ON post_votes FOR DELETE USING (auth.uid() = user_id);

-- ---- EVENTS ----
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved events are readable by everyone"
  ON events FOR SELECT USING (status = 'approved' OR auth.uid() = user_id OR is_moderator_or_above());

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit own pending events, moderators can edit any"
  ON events FOR UPDATE USING (auth.uid() = user_id OR is_moderator_or_above());

CREATE POLICY "Users can delete own pending events, moderators can delete any"
  ON events FOR DELETE USING (
    (auth.uid() = user_id AND status = 'pending')
    OR is_moderator_or_above()
  );

-- ---- REPORTS ----
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reports"
  ON reports FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins and social workers can view reports"
  ON reports FOR SELECT USING (
    auth.uid() = user_id
    OR is_admin()
    OR get_user_role() = 'social_worker'
  );

CREATE POLICY "Admins and social workers can update reports"
  ON reports FOR UPDATE USING (
    is_admin() OR get_user_role() = 'social_worker'
  );

-- ============================================================
-- 10. USEFUL VIEWS
-- ============================================================

-- Profile with location info (for displaying "from City, ST")
CREATE OR REPLACE VIEW profiles_with_location AS
SELECT
  p.*,
  z.city,
  z.state_code,
  z.county,
  z.latitude,
  z.longitude
FROM profiles p
JOIN zip_codes z ON p.zip_code = z.zip;

-- Comments with author info (for nested thread display)
CREATE OR REPLACE VIEW comments_with_author AS
SELECT
  c.*,
  p.display_name AS author_name,
  z.city AS author_city,
  z.state_code AS author_state
FROM resource_comments c
JOIN profiles p ON c.user_id = p.id
JOIN zip_codes z ON p.zip_code = z.zip;

-- Events with author info
CREATE OR REPLACE VIEW events_with_author AS
SELECT
  e.*,
  p.display_name AS author_name,
  z.city AS event_city,
  z.state_code AS event_state,
  z.county AS event_county
FROM events e
JOIN profiles p ON e.user_id = p.id
JOIN zip_codes z ON e.zip_code = z.zip;

-- Posts with author info
CREATE OR REPLACE VIEW posts_with_author AS
SELECT
  cp.*,
  p.display_name AS author_name,
  z.city AS author_city,
  z.state_code AS author_state
FROM community_posts cp
LEFT JOIN profiles p ON cp.user_id = p.id
LEFT JOIN zip_codes z ON p.zip_code = z.zip;
