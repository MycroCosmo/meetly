# Supabase Edge Functions

이 디렉토리에는 Supabase Edge Functions가 포함되어 있습니다.

## Functions

### 1. availability-overlap
가용성 블록을 30분 단위로 집계하여 오버랩을 계산합니다.

**엔드포인트**: `/functions/v1/availability-overlap`

**요청**:
```json
{
  "room_id": "uuid",
  "slot_minutes": 30  // optional, default: 30
}
```

**응답**:
```json
{
  "data": [
    {
      "slot_start": "2024-04-15T14:00:00Z",
      "slot_end": "2024-04-15T14:30:00Z",
      "participant_count": 3
    }
  ]
}
```

### 2. cleanup-expired-rooms
만료된 방을 삭제하는 크론 작업입니다.

**엔드포인트**: `/functions/v1/cleanup-expired-rooms`

**인증**: Service Role Key 필요

**크론 설정**:
Supabase Dashboard에서 이 함수를 매시간 실행하도록 크론 작업을 설정하세요.

## 배포 방법

### Supabase CLI 사용
```bash
supabase functions deploy availability-overlap
supabase functions deploy cleanup-expired-rooms
```

### 환경 변수
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (cleanup-expired-rooms만)

## 크론 작업 설정

Supabase Dashboard에서:
1. Database → Cron Jobs로 이동
2. 새 크론 작업 생성
3. Schedule: `0 * * * *` (매시간)
4. Function: `cleanup-expired-rooms`
5. Headers에 Service Role Key 포함
