// Supabase Edge Function: Cleanup Expired Rooms
// This function should be triggered by a cron job (hourly)
// Deletes rooms where expire_at < NOW() and all related data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify this is called by a cron job or with service role key
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find expired rooms
    const { data: expiredRooms, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .lt('expire_at', new Date().toISOString())

    if (fetchError) {
      throw fetchError
    }

    if (!expiredRooms || expiredRooms.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No expired rooms to clean up',
          deleted_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete expired rooms (CASCADE will handle child records)
    const roomIds = expiredRooms.map(r => r.id)
    const { error: deleteError } = await supabaseAdmin
      .from('rooms')
      .delete()
      .in('id', roomIds)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({ 
        message: 'Expired rooms cleaned up successfully',
        deleted_count: roomIds.length,
        room_ids: roomIds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
