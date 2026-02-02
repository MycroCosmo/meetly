// types/index.ts
export type TimeVote = {
  slot_start: string
  slot_end: string
  participant_count: number
}

export type PlaceVote = {
  id: string
  name: string
  address: string | null
  url: string | null
  vote_count: number
}

export type PlaceCandidate = {
  id: string
  room_id: string
  name: string
  address: string | null
  url: string | null
  created_at: string
  created_by_participant_id: string | null
}

export type AvailabilityBlock = {
  id: string
  room_id: string
  participant_id: string
  start_at: string
  end_at: string
  created_at: string
}
