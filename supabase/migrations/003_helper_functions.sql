-- Helper Functions for Meetly

-- ============================================
-- Function to generate unique room code
-- ============================================
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-8 character alphanumeric code
    code := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    code := regexp_replace(code, '[^a-z0-9]', '', 'g');
    code := substring(code from 1 for 6);
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM rooms WHERE rooms.code = code) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to hash participant token
-- ============================================
CREATE OR REPLACE FUNCTION hash_token(token TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(token, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to set participant token context
-- This should be called before RLS checks
-- ============================================
CREATE OR REPLACE FUNCTION set_participant_token_context(token TEXT)
RETURNS VOID AS $$
DECLARE
  token_hash TEXT;
BEGIN
  token_hash := hash_token(token);
  PERFORM set_config('app.participant_token_hash', token_hash, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to calculate availability overlap
-- Returns overlapping time ranges in 30-minute slots
-- ============================================
CREATE OR REPLACE FUNCTION calculate_availability_overlap(
  p_room_id UUID,
  slot_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  participant_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT
      generate_series(
        date_trunc('day', MIN(ab.start_at)),
        date_trunc('day', MAX(ab.end_at)) + INTERVAL '1 day',
        (slot_minutes || ' minutes')::INTERVAL
      ) AS slot_start
    FROM availability_blocks ab
    WHERE ab.room_id = p_room_id
  ),
  slot_overlaps AS (
    SELECT
      ts.slot_start,
      ts.slot_start + (slot_minutes || ' minutes')::INTERVAL AS slot_end,
      COUNT(DISTINCT ab.participant_id) AS participant_count
    FROM time_slots ts
    JOIN availability_blocks ab ON (
      ab.room_id = p_room_id
      AND tstzrange(ab.start_at, ab.end_at) && tstzrange(ts.slot_start, ts.slot_start + (slot_minutes || ' minutes')::INTERVAL)
    )
    GROUP BY ts.slot_start
  )
  SELECT
    so.slot_start,
    so.slot_end,
    so.participant_count
  FROM slot_overlaps so
  WHERE so.participant_count > 0
  ORDER BY so.participant_count DESC, so.slot_start ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to get room participant count
-- ============================================
CREATE OR REPLACE FUNCTION get_room_participant_count(p_room_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM participants
  WHERE room_id = p_room_id;
  
  RETURN count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to get place vote counts
-- ============================================
CREATE OR REPLACE FUNCTION get_place_vote_counts(p_room_id UUID)
RETURNS TABLE (
  candidate_id UUID,
  vote_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.candidate_id,
    COUNT(*) AS vote_count
  FROM place_votes pv
  WHERE pv.room_id = p_room_id
  GROUP BY pv.candidate_id
  ORDER BY vote_count DESC;
END;
$$ LANGUAGE plpgsql;
