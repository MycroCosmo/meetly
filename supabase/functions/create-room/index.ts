import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  title: string;
  description?: string | null;
  nickname: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const bad = (message: string, status = 400, extra?: unknown) =>
  json({ error: message, ...(extra ? { detail: extra } : {}) }, status);

// 코드(초대코드) 생성: 읽기 쉽고 짧게
const makeRoomCode = (len = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

// 참가자 토큰(로컬 저장용)
const makeToken = () => crypto.randomUUID() + crypto.randomUUID();

/** ✅ sha256 hex (Deno/WebCrypto) */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("Method not allowed", 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const title = (body.title ?? "").trim();
  const nickname = (body.nickname ?? "").trim();
  const description =
    (body.description ?? null)?.toString?.().trim?.() ?? body.description ?? null;

  if (!title) return bad("title is required");
  if (!nickname) return bad("nickname is required");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return bad("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const createdAt = now.toISOString();
  const expireAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();

  // 1) rooms 생성
  const roomId = crypto.randomUUID();
  const code = makeRoomCode(6);

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .insert({
      id: roomId,
      title,
      description,
      code,
      created_at: createdAt,
      expire_at: expireAt,
      owner_user_id: null,
      owner_participant_id: null,
    })
    .select("id, code")
    .single();

  if (roomErr || !room) {
    return bad(roomErr?.message ?? "failed to create room", 500, roomErr);
  }

  // 2) 방장 participant 생성
  const token = makeToken();
  const tokenHash = await sha256Hex(token); // ✅ 핵심
  const hostId = crypto.randomUUID();

  const { data: host, error: hostErr } = await admin
    .from("participants")
    .insert({
      id: hostId,
      room_id: room.id,
      nickname,
      token_hash: tokenHash, // ✅ 핵심: 해시 저장
      user_id: null,
      anytime_ok: false,
      created_at: createdAt,
    })
    .select("id")
    .single();

  if (hostErr || !host) {
    return bad(hostErr?.message ?? "failed to create host", 500, hostErr);
  }

  // 3) rooms에 방장 지정
  const { error: updErr } = await admin
    .from("rooms")
    .update({ owner_participant_id: host.id })
    .eq("id", room.id);

  if (updErr) {
    return bad(updErr.message ?? "failed to set room owner", 500, updErr);
  }

  return json({
    room_id: room.id,
    room_code: room.code,
    participant_id: host.id,
    participant_token: token, // ✅ raw token은 그대로 클라이언트에 내려줌
  });
});
