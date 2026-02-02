/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AvailabilityBlock = {
  room_id: string;
  participant_id: string;
  start_at: string;
  end_at: string;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function computeOverlap(
  blocks: AvailabilityBlock[],
  slotMinutes: number,
): Array<{ slot_start: string; slot_end: string; participant_count: number }> {
  if (blocks.length === 0) return [];

  let minStart = Infinity;
  let maxEnd = -Infinity;

  const parsed = blocks
    .map((b) => {
      const s = Date.parse(b.start_at);
      const e = Date.parse(b.end_at);
      return { ...b, s, e };
    })
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e) && b.e > b.s);

  if (parsed.length === 0) return [];

  for (const b of parsed) {
    if (b.s < minStart) minStart = b.s;
    if (b.e > maxEnd) maxEnd = b.e;
  }

  const slotMs = slotMinutes * 60 * 1000;
  const base = Math.floor(minStart / slotMs) * slotMs;

  const results: Array<{ slot_start: string; slot_end: string; participant_count: number }> = [];

  for (let t = base; t < maxEnd; t += slotMs) {
    const slotStart = t;
    const slotEnd = t + slotMs;

    const set = new Set<string>();
    for (const b of parsed) {
      if (b.s < slotEnd && b.e > slotStart) set.add(b.participant_id);
    }

    const c = set.size;
    if (c >= 1) {
      results.push({
        slot_start: new Date(slotStart).toISOString(),
        slot_end: new Date(slotEnd).toISOString(),
        participant_count: c,
      });
    }
  }

  results.sort((a, b) => {
    if (b.participant_count !== a.participant_count) return b.participant_count - a.participant_count;
    return Date.parse(a.slot_start) - Date.parse(b.slot_start);
  });

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const room_id = String(body?.room_id ?? "").trim();
    const slot_minutes = Number(body?.slot_minutes ?? 30);

    if (!room_id) return json({ error: "room_id is required" }, 400);
    if (!Number.isFinite(slot_minutes) || slot_minutes <= 0 || slot_minutes > 180) {
      return json({ error: "slot_minutes must be a number between 1 and 180" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY env" }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("availability_blocks")
      .select("room_id, participant_id, start_at, end_at")
      .eq("room_id", room_id);

    if (error) return json({ error: error.message }, 500);

    const blocks = (data ?? []) as AvailabilityBlock[];

    /**
     * ✅ "상관없음(하루종일)" 분리
     * - 상관없음 인원은 요약에서만 '상관없음 N명'으로 표시
     * - 슬롯별 겹침 집계에서는 제외(추천 UX)
     */
    const ALLDAY_THRESHOLD_MS = 23.5 * 60 * 60 * 1000; // 23.5h 이상이면 all-day로 간주

    const allDayParticipantSet = new Set<string>();
    const normalBlocks: AvailabilityBlock[] = [];

    for (const b of blocks) {
      const s = Date.parse(b.start_at);
      const e = Date.parse(b.end_at);
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;

      if (e - s >= ALLDAY_THRESHOLD_MS) {
        allDayParticipantSet.add(b.participant_id);
      } else {
        normalBlocks.push(b);
      }
    }

    const overlap = computeOverlap(normalBlocks, slot_minutes);

    return json(
      {
        data: overlap,
        meta: {
          all_day_count: allDayParticipantSet.size,
        },
      },
      200,
    );
  } catch (e) {
    return json({ error: (e as any)?.message ?? "Server error" }, 500);
  }
});
