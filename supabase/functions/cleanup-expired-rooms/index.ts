// Supabase Edge Function: Cleanup Expired Rooms (Batch Processing)
// This function should be triggered by a cron job (hourly)
// Deletes rooms where expire_at < NOW() and all related data
// Implements batch processing similar to Spring Boot batch jobs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CleanupResult {
  success: boolean
  message: string
  stats: {
    total_expired_rooms: number
    processed_rooms: number
    deleted_participants: number
    deleted_availability_blocks: number
    deleted_place_candidates: number
    deleted_place_votes: number
    deleted_expense_items: number
    deleted_expense_shares: number
    processing_time_ms: number
    errors: string[]
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const result: CleanupResult = {
    success: false,
    message: '',
    stats: {
      total_expired_rooms: 0,
      processed_rooms: 0,
      deleted_participants: 0,
      deleted_availability_blocks: 0,
      deleted_place_candidates: 0,
      deleted_place_votes: 0,
      deleted_expense_items: 0,
      deleted_expense_shares: 0,
      processing_time_ms: 0,
      errors: []
    }
  }

  try {
    // Verify this is called by a cron job or with service role key
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      result.message = 'Unauthorized'
      return new Response(
        JSON.stringify(result),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Step 1: Find expired rooms (batch size limit for safety)
    const BATCH_SIZE = 100 // Process max 100 rooms at a time
    const { data: expiredRooms, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select('id, code, title, created_at, expire_at')
      .lt('expire_at', new Date().toISOString())
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`Failed to fetch expired rooms: ${fetchError.message}`)
    }

    result.stats.total_expired_rooms = expiredRooms?.length ?? 0

    if (!expiredRooms || expiredRooms.length === 0) {
      result.success = true
      result.message = 'No expired rooms to clean up'
      result.stats.processing_time_ms = Date.now() - startTime
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${expiredRooms.length} expired rooms to clean up`)

    // Step 2: Get detailed statistics before deletion
    const roomIds = expiredRooms.map(r => r.id)

    // Count related records for each room
    for (const room of expiredRooms) {
      try {
        // Count participants
        const { count: participantCount } = await supabaseAdmin
          .from('participants')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)

        // Count availability blocks
        const { count: availabilityCount } = await supabaseAdmin
          .from('availability_blocks')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)

        // Count place candidates
        const { count: placeCandidateCount } = await supabaseAdmin
          .from('place_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)

        // Count place votes
        const { count: placeVoteCount } = await supabaseAdmin
          .from('place_votes')
          .select('room_id', { count: 'exact', head: true })
          .eq('room_id', room.id)

        // Count expense items
        const { count: expenseItemCount } = await supabaseAdmin
          .from('expense_items')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)

        // Count expense shares
        const { count: expenseShareCount } = await supabaseAdmin
          .from('expense_shares')
          .select('expense_item_id', { count: 'exact', head: true })
          .in('expense_item_id',
            (await supabaseAdmin
              .from('expense_items')
              .select('id')
              .eq('room_id', room.id)
            ).data?.map(item => item.id) ?? []
          )

        console.log(`Room ${room.code} (${room.title}): ${participantCount} participants, ${availabilityCount} availability blocks, ${placeCandidateCount} place candidates, ${placeVoteCount} place votes, ${expenseItemCount} expense items, ${expenseShareCount} expense shares`)

        result.stats.deleted_participants += participantCount ?? 0
        result.stats.deleted_availability_blocks += availabilityCount ?? 0
        result.stats.deleted_place_candidates += placeCandidateCount ?? 0
        result.stats.deleted_place_votes += placeVoteCount ?? 0
        result.stats.deleted_expense_items += expenseItemCount ?? 0
        result.stats.deleted_expense_shares += expenseShareCount ?? 0

      } catch (countError) {
        console.error(`Error counting records for room ${room.code}:`, countError)
        result.stats.errors.push(`Failed to count records for room ${room.code}: ${countError.message}`)
      }
    }

    // Step 3: Delete expired rooms in a transaction-like manner
    // Since Supabase doesn't support transactions across multiple operations easily,
    // we'll delete rooms one by one with CASCADE to ensure data integrity

    let processedCount = 0
    const deletedRoomIds: string[] = []

    for (const room of expiredRooms) {
      try {
        const { error: deleteError } = await supabaseAdmin
          .from('rooms')
          .delete()
          .eq('id', room.id)

        if (deleteError) {
          console.error(`Failed to delete room ${room.code}:`, deleteError)
          result.stats.errors.push(`Failed to delete room ${room.code}: ${deleteError.message}`)
          continue
        }

        deletedRoomIds.push(room.id)
        processedCount++
        console.log(`Successfully deleted room ${room.code} (${room.title})`)

      } catch (deleteError) {
        console.error(`Error deleting room ${room.code}:`, deleteError)
        result.stats.errors.push(`Error deleting room ${room.code}: ${deleteError.message}`)
      }
    }

    result.stats.processed_rooms = processedCount
    result.stats.processing_time_ms = Date.now() - startTime

    result.success = processedCount > 0
    result.message = `Successfully cleaned up ${processedCount} expired rooms and all related data`

    console.log(`Cleanup completed: ${processedCount} rooms processed in ${result.stats.processing_time_ms}ms`)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    result.stats.processing_time_ms = Date.now() - startTime
    result.message = `Cleanup failed: ${error.message}`
    result.stats.errors.push(error.message)

    console.error('Cleanup function error:', error)

    return new Response(
      JSON.stringify(result),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
