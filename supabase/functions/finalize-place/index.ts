// supabase/functions/finalize-place/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

type Body = {
  room_id: string
  place_id: string
  token: string
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing env vars" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = (await req.json()) as Body
    const roomId = (body.room_id ?? "").trim()
    const placeId = (body.place_id ?? "").trim()
    const token = (body.token ?? "").trim()

    if (!roomId || !placeId || !token) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 1) 토큰으로 참가자 찾기
    const tokenHash = await sha256Hex(token)

    const { data: me, error: meErr } = await supabase
      .from("participants")
      .select("id")
      .eq("room_id", roomId)
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (meErr) throw meErr
    if (!me) {
      return new Response(JSON.stringify({ error: "Participant not found (invalid token)" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 2) 방장 판별
    const { data: host, error: hostErr } = await supabase
      .from("participants")
      .select("id")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (hostErr) throw hostErr
    if (!host) {
      return new Response(JSON.stringify({ error: "Host not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (host.id !== me.id) {
      return new Response(JSON.stringify({ error: "Only host can finalize place" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 3) place 후보가 실제 존재하는지 최소 검증(선택)
    const { data: candidate, error: cErr } = await supabase
      .from("place_candidates")
      .select("id")
      .eq("room_id", roomId)
      .eq("id", placeId)
      .maybeSingle()

    if (cErr) throw cErr
    if (!candidate) {
      return new Response(JSON.stringify({ error: "Invalid place candidate" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 4) rooms 업데이트
    const { data: updated, error: upErr } = await supabase
      .from("rooms")
      .update({ finalized_place_id: placeId })
      .eq("id", roomId)
      .select("*")
      .maybeSingle()

    if (upErr) throw upErr

    return new Response(JSON.stringify({ room: updated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
