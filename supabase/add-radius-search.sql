-- ============================================================
-- RADIUS-BASED RESOURCE SEARCH
-- Replaces get_resources_for_location and
-- count_resources_for_location with versions that:
--   1. Accept p_lat, p_lng, p_radius_miles parameters
--   2. Use a Haversine CTE to find zip codes within radius
--   3. Filter county/city/zip_specific resources by proximity
--   4. Always include state and national resources
--   5. Return distance_miles for nearby-scoped results
--
-- Run this in the Supabase SQL Editor after migration.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION get_resources_for_location(
  p_zip          TEXT,
  p_city         TEXT,
  p_county       TEXT,
  p_state_code   TEXT,
  p_lat          DOUBLE PRECISION,
  p_lng          DOUBLE PRECISION,
  p_radius_miles INT     DEFAULT 25,
  p_category_slug TEXT   DEFAULT NULL,
  p_limit        INT     DEFAULT 20,
  p_offset       INT     DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  description         TEXT,
  cat_slug            TEXT,
  cat_name            TEXT,
  cat_icon            TEXT,
  subcategory         TEXT,
  scope               resource_scope,
  url                 TEXT,
  phone               TEXT,
  address             TEXT,
  eligibility_summary TEXT,
  income_limit_notes  TEXT,
  hours               TEXT,
  languages           TEXT,
  net_score           INT,
  verified_at         TIMESTAMPTZ,
  distance_miles      DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH nearby_zips AS (
    -- All zip codes within p_radius_miles of the searched location,
    -- with their distances pre-computed for re-use below.
    SELECT
      z.zip,
      z.county,
      z.state_code,
      2 * 3958.8 * asin(sqrt(
        power(sin(radians(z.latitude  - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(z.latitude)) *
        power(sin(radians(z.longitude - p_lng) / 2), 2)
      )) AS dist_miles
    FROM zip_codes z
    WHERE (
      2 * 3958.8 * asin(sqrt(
        power(sin(radians(z.latitude  - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(z.latitude)) *
        power(sin(radians(z.longitude - p_lng) / 2), 2)
      ))
    ) <= p_radius_miles
  ),
  base AS (
    SELECT
      r.id,
      r.name,
      r.description,
      c.slug  AS cat_slug,
      c.name  AS cat_name,
      c.icon  AS cat_icon,
      r.subcategory,
      r.scope,
      r.url,
      r.phone,
      r.address,
      r.eligibility_summary,
      r.income_limit_notes,
      r.hours,
      r.languages,
      r.net_score,
      r.verified_at,
      -- Distance to the nearest zip associated with this resource.
      -- NULL for state/national (they have no geographic anchor).
      CASE
        WHEN r.scope = 'zip_specific' THEN (
          SELECT MIN(nz.dist_miles)
          FROM resource_zip_codes rz2
          JOIN nearby_zips nz ON rz2.zip_code = nz.zip
          WHERE rz2.resource_id = r.id
        )
        WHEN r.scope IN ('county', 'city') THEN (
          SELECT MIN(nz.dist_miles)
          FROM nearby_zips nz
          WHERE nz.county = r.county
            AND nz.state_code = p_state_code
        )
        ELSE NULL
      END AS distance_miles
    FROM resources r
    JOIN categories c ON r.category_id = c.id
    WHERE
      r.link_status = 'ok'
      AND (p_category_slug IS NULL OR c.slug = p_category_slug)
      AND (
        r.scope = 'national'
        OR (r.scope = 'state' AND r.state_code = p_state_code)
        OR (
          r.scope IN ('county', 'city')
          AND r.state_code = p_state_code
          AND (
            -- No county data: fall through to statewide display (distance_miles will be NULL)
            r.county IS NULL
            -- Only show county/city resources for the exact county of the searched zip
            OR r.county = p_county
          )
        )
        OR (
          r.scope = 'zip_specific'
          AND EXISTS (
            SELECT 1 FROM resource_zip_codes rz
            JOIN nearby_zips nz ON rz.zip_code = nz.zip
            WHERE rz.resource_id = r.id
          )
        )
      )
  )
  SELECT
    b.id,
    b.name,
    b.description,
    b.cat_slug,
    b.cat_name,
    b.cat_icon,
    b.subcategory,
    b.scope,
    b.url,
    b.phone,
    b.address,
    b.eligibility_summary,
    b.income_limit_notes,
    b.hours,
    b.languages,
    b.net_score,
    b.verified_at,
    b.distance_miles
  FROM base b
  ORDER BY
    -- Broad scopes (state, national) always follow nearby results
    CASE WHEN b.scope IN ('state', 'national') THEN 1 ELSE 0 END ASC,
    -- Within broad: state before national
    CASE b.scope WHEN 'state' THEN 1 WHEN 'national' THEN 2 ELSE 0 END ASC,
    -- Within nearby: closest first
    b.distance_miles ASC NULLS LAST,
    -- Tiebreak by score then name
    b.net_score DESC,
    b.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================
-- COUNT VERSION (for pagination)
-- Same radius filter, no distance_miles needed.
-- ============================================================

CREATE OR REPLACE FUNCTION count_resources_for_location(
  p_zip          TEXT,
  p_city         TEXT,
  p_county       TEXT,
  p_state_code   TEXT,
  p_lat          DOUBLE PRECISION,
  p_lng          DOUBLE PRECISION,
  p_radius_miles INT    DEFAULT 25,
  p_category_slug TEXT  DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  result BIGINT;
BEGIN
  WITH nearby_zips AS (
    SELECT
      z.zip,
      z.county,
      z.state_code
    FROM zip_codes z
    WHERE (
      2 * 3958.8 * asin(sqrt(
        power(sin(radians(z.latitude  - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(z.latitude)) *
        power(sin(radians(z.longitude - p_lng) / 2), 2)
      ))
    ) <= p_radius_miles
  )
  SELECT COUNT(DISTINCT r.id) INTO result
  FROM resources r
  JOIN categories c ON r.category_id = c.id
  WHERE
    r.link_status = 'ok'
    AND (p_category_slug IS NULL OR c.slug = p_category_slug)
    AND (
      r.scope = 'national'
      OR (r.scope = 'state' AND r.state_code = p_state_code)
      OR (
        r.scope IN ('county', 'city')
        AND r.state_code = p_state_code
        AND (
          r.county IS NULL
          OR r.county = p_county
        )
      )
      OR (
        r.scope = 'zip_specific'
        AND EXISTS (
          SELECT 1 FROM resource_zip_codes rz
          JOIN nearby_zips nz ON rz.zip_code = nz.zip
          WHERE rz.resource_id = r.id
        )
      )
    );
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
