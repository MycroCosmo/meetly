-- Meetly Database Schema
-- Supabase PostgreSQL Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ROOMS
-- ============================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expire_at TIMESTAMPTZ NOT NULL,
  finalized_time_start TIMESTAMPTZ,
  finalized_time_end TIMESTAMPTZ,
  finalized_place_id UUID,
  CONSTRAINT code_format CHECK (code ~ '^[a-z0-9]{6,10}$')
);

CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_owner_user_id ON rooms(owner_user_id);
CREATE INDEX idx_rooms_expire_at ON rooms(expire_at);

-- ============================================
-- PARTICIPANTS
-- ============================================
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  token_hash TEXT, -- Hashed participantToken for anonymous users
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- For logged-in users
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT participant_identity CHECK (
    (token_hash IS NOT NULL AND user_id IS NULL) OR
    (token_hash IS NULL AND user_id IS NOT NULL)
  )
);

CREATE INDEX idx_participants_room_id ON participants(room_id);
CREATE INDEX idx_participants_user_id ON participants(user_id);
CREATE INDEX idx_participants_token_hash ON participants(token_hash);

-- ============================================
-- AVAILABILITY BLOCKS
-- ============================================
CREATE TABLE availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

CREATE INDEX idx_availability_blocks_room_id ON availability_blocks(room_id);
CREATE INDEX idx_availability_blocks_participant_id ON availability_blocks(participant_id);
CREATE INDEX idx_availability_blocks_time_range ON availability_blocks USING GIST (tstzrange(start_at, end_at));

-- ============================================
-- PLACE CANDIDATES
-- ============================================
CREATE TABLE place_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  created_by_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_place_candidates_room_id ON place_candidates(room_id);
CREATE INDEX idx_place_candidates_created_by ON place_candidates(created_by_participant_id);

-- Add foreign key constraint for finalized_place_id
ALTER TABLE rooms ADD CONSTRAINT fk_finalized_place 
  FOREIGN KEY (finalized_place_id) REFERENCES place_candidates(id) ON DELETE SET NULL;

-- ============================================
-- PLACE VOTES
-- ============================================
CREATE TABLE place_votes (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES place_candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, participant_id),
  CONSTRAINT one_vote_per_participant UNIQUE (room_id, participant_id)
);

CREATE INDEX idx_place_votes_room_id ON place_votes(room_id);
CREATE INDEX idx_place_votes_candidate_id ON place_votes(candidate_id);

-- ============================================
-- EXPENSE ITEMS
-- ============================================
CREATE TYPE split_type AS ENUM ('EQUAL', 'CUSTOM');

CREATE TABLE expense_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
  payer_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  split_type split_type NOT NULL DEFAULT 'EQUAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_items_room_id ON expense_items(room_id);
CREATE INDEX idx_expense_items_payer ON expense_items(payer_participant_id);

-- ============================================
-- EXPENSE SHARES
-- ============================================
CREATE TABLE expense_shares (
  expense_item_id UUID NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (expense_item_id, participant_id)
);

CREATE INDEX idx_expense_shares_expense_item ON expense_shares(expense_item_id);
CREATE INDEX idx_expense_shares_participant ON expense_shares(participant_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to validate custom split sum
CREATE OR REPLACE FUNCTION validate_custom_split()
RETURNS TRIGGER AS $$
DECLARE
  total DECIMAL(12, 2);
  expense_total DECIMAL(12, 2);
BEGIN
  -- Only validate for CUSTOM split type
  IF (SELECT split_type FROM expense_items WHERE id = NEW.expense_item_id) = 'CUSTOM' THEN
    -- Calculate sum of all shares for this expense item
    SELECT COALESCE(SUM(amount), 0) INTO total
    FROM expense_shares
    WHERE expense_item_id = NEW.expense_item_id;
    
    -- Get the total amount of the expense item
    SELECT total_amount INTO expense_total
    FROM expense_items
    WHERE id = NEW.expense_item_id;
    
    -- Check if sum matches total (allow small floating point differences)
    IF ABS(total - expense_total) > 0.01 THEN
      RAISE EXCEPTION 'Custom split shares must sum to the total amount. Current sum: %, Expected: %', total, expense_total;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate custom split on insert/update
CREATE TRIGGER trigger_validate_custom_split
AFTER INSERT OR UPDATE ON expense_shares
FOR EACH ROW
EXECUTE FUNCTION validate_custom_split();

-- Function to auto-calculate equal split
CREATE OR REPLACE FUNCTION auto_calculate_equal_split()
RETURNS TRIGGER AS $$
DECLARE
  participant_count INTEGER;
  share_amount DECIMAL(12, 2);
BEGIN
  -- Only for EQUAL split type
  IF NEW.split_type = 'EQUAL' THEN
    -- Count active participants in the room
    SELECT COUNT(*) INTO participant_count
    FROM participants
    WHERE room_id = NEW.room_id;
    
    IF participant_count > 0 THEN
      share_amount := NEW.total_amount / participant_count;
      
      -- Delete existing shares
      DELETE FROM expense_shares WHERE expense_item_id = NEW.id;
      
      -- Insert equal shares for all participants
      INSERT INTO expense_shares (expense_item_id, participant_id, amount)
      SELECT NEW.id, id, share_amount
      FROM participants
      WHERE room_id = NEW.room_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate equal split
CREATE TRIGGER trigger_auto_calculate_equal_split
AFTER INSERT OR UPDATE OF split_type, total_amount ON expense_items
FOR EACH ROW
WHEN (NEW.split_type = 'EQUAL')
EXECUTE FUNCTION auto_calculate_equal_split();

-- Function to update last_seen_at
CREATE OR REPLACE FUNCTION update_participant_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE participants
  SET last_seen_at = NOW()
  WHERE id = NEW.participant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen_at on availability block operations
CREATE TRIGGER trigger_update_last_seen_availability
AFTER INSERT OR UPDATE ON availability_blocks
FOR EACH ROW
EXECUTE FUNCTION update_participant_last_seen();

-- Trigger to update last_seen_at on place vote operations
CREATE TRIGGER trigger_update_last_seen_vote
AFTER INSERT OR UPDATE ON place_votes
FOR EACH ROW
EXECUTE FUNCTION update_participant_last_seen();
