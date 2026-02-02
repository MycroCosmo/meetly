-- Row Level Security (RLS) Policies for Meetly
-- Enable RLS on all tables

-- ============================================
-- ROOMS
-- ============================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Anyone can read rooms (for public access)
CREATE POLICY "Anyone can read rooms"
  ON rooms FOR SELECT
  USING (true);

-- Only authenticated users can create rooms with owner_user_id
CREATE POLICY "Authenticated users can create owned rooms"
  ON rooms FOR INSERT
  WITH CHECK (
    (owner_user_id IS NULL) OR
    (owner_user_id IS NOT NULL AND auth.uid() = owner_user_id)
  );

-- Room owners can update their rooms
CREATE POLICY "Room owners can update their rooms"
  ON rooms FOR UPDATE
  USING (
    owner_user_id IS NULL OR
    auth.uid() = owner_user_id
  );

-- Room owners can delete their rooms
CREATE POLICY "Room owners can delete their rooms"
  ON rooms FOR DELETE
  USING (
    owner_user_id IS NULL OR
    auth.uid() = owner_user_id
  );

-- ============================================
-- PARTICIPANTS
-- ============================================
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Anyone can read participants in a room (for transparency)
CREATE POLICY "Anyone can read participants"
  ON participants FOR SELECT
  USING (true);

-- Anyone can create participants (for anonymous access)
CREATE POLICY "Anyone can create participants"
  ON participants FOR INSERT
  WITH CHECK (true);

-- Participants can update their own nickname
-- For anonymous: check via token_hash
-- For logged-in: check via user_id
CREATE POLICY "Participants can update their own data"
  ON participants FOR UPDATE
  USING (
    (token_hash IS NOT NULL AND token_hash = current_setting('app.participant_token_hash', true)) OR
    (user_id IS NOT NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    (token_hash IS NOT NULL AND token_hash = current_setting('app.participant_token_hash', true)) OR
    (user_id IS NOT NULL AND auth.uid() = user_id)
  );

-- Participants can delete themselves
CREATE POLICY "Participants can delete themselves"
  ON participants FOR DELETE
  USING (
    (token_hash IS NOT NULL AND token_hash = current_setting('app.participant_token_hash', true)) OR
    (user_id IS NOT NULL AND auth.uid() = user_id)
  );

-- ============================================
-- AVAILABILITY BLOCKS
-- ============================================
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

-- Anyone can read availability blocks (for transparency)
CREATE POLICY "Anyone can read availability blocks"
  ON availability_blocks FOR SELECT
  USING (true);

-- Participants can create their own availability blocks
CREATE POLICY "Participants can create their own availability"
  ON availability_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- Participants can update their own availability blocks
CREATE POLICY "Participants can update their own availability"
  ON availability_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- Participants can delete their own availability blocks
CREATE POLICY "Participants can delete their own availability"
  ON availability_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- ============================================
-- PLACE CANDIDATES
-- ============================================
ALTER TABLE place_candidates ENABLE ROW LEVEL SECURITY;

-- Anyone can read place candidates
CREATE POLICY "Anyone can read place candidates"
  ON place_candidates FOR SELECT
  USING (true);

-- Participants can create place candidates
CREATE POLICY "Participants can create place candidates"
  ON place_candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = created_by_participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- Only the creator can update place candidates
CREATE POLICY "Creators can update their place candidates"
  ON place_candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = created_by_participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- Only the creator can delete place candidates
CREATE POLICY "Creators can delete their place candidates"
  ON place_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = created_by_participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- ============================================
-- PLACE VOTES
-- ============================================
ALTER TABLE place_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read place votes (for transparency)
CREATE POLICY "Anyone can read place votes"
  ON place_votes FOR SELECT
  USING (true);

-- Participants can create/update their own vote
CREATE POLICY "Participants can vote"
  ON place_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

CREATE POLICY "Participants can update their vote"
  ON place_votes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- Participants can delete their own vote
CREATE POLICY "Participants can delete their vote"
  ON place_votes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- ============================================
-- EXPENSE ITEMS
-- ============================================
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read expense items
CREATE POLICY "Anyone can read expense items"
  ON expense_items FOR SELECT
  USING (true);

-- Participants can create expense items
CREATE POLICY "Participants can create expense items"
  ON expense_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = payer_participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- Only the payer can update expense items
CREATE POLICY "Payers can update their expense items"
  ON expense_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = payer_participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- Only the payer can delete expense items
CREATE POLICY "Payers can delete their expense items"
  ON expense_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = payer_participant_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );

-- ============================================
-- EXPENSE SHARES
-- ============================================
ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;

-- Anyone can read expense shares
CREATE POLICY "Anyone can read expense shares"
  ON expense_shares FOR SELECT
  USING (true);

-- Only the expense item payer can manage shares
CREATE POLICY "Expense payers can manage shares"
  ON expense_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM expense_items ei
      JOIN participants p ON p.id = ei.payer_participant_id
      WHERE ei.id = expense_item_id
      AND (
        (p.token_hash IS NOT NULL AND p.token_hash = current_setting('app.participant_token_hash', true)) OR
        (p.user_id IS NOT NULL AND auth.uid() = p.user_id)
      )
    )
  );
