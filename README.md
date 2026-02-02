# Meetly

그룹 스케줄링을 위한 모바일 우선 웹 애플리케이션. When2Meet 스타일의 가용성 오버랩 기능에 장소 투표와 비용 분할 기능을 추가했습니다.

## 해결하는 문제

When2Meet는 가용성 오버랩에 초점을 맞춘 훌륭한 도구이지만, 실제 그룹 모임을 계획할 때는 다음과 같은 추가 기능이 필요합니다:

1. **장소 결정**: 시간만으로는 부족하며, 어디서 만날지 결정해야 합니다.
2. **비용 분할**: 여행이나 모임에서 공동 비용을 투명하게 분할해야 합니다.
3. **익명 참여자 지원**: 회원가입 없이도 참여할 수 있어야 합니다.
4. **TTL 관리**: 일시적인 모임을 위한 자동 정리 기능이 필요합니다.

## 주요 기능

### 1. 가용성 오버랩 (When2Meet 스타일)
- 참여자가 가용성 시간 범위를 제출
- 30분 단위로 오버랩 계산 및 시각화
- 상위 오버랩 시간 범위 표시

### 2. 장소 투표
- 장소 후보 추가 (이름, 주소, 좌표)
- 참여자당 1표 투표
- 투표 수 실시간 표시
- 방 소유자가 최종 장소 확정

### 3. 비용 분할
- 비용 항목 추가 (제목, 총액, 지불자)
- 분할 유형:
  - **EQUAL**: 자동으로 1/n 계산
  - **CUSTOM**: 참여자별 수동 금액 입력 (합계 검증)
- 각 참여자의 부담 금액 표시

### 4. 요약 및 공유
- 확정된 시간 및 장소 표시
- 공유 가능한 텍스트 블록 생성 (클립보드 복사)

## 기술 스택

### Frontend
- **Nuxt3**: Vue 3 기반, SSR 불필요 (SPA 모드)
- **모바일 우선**: 반응형 디자인, 데스크톱은 폴백

### Backend
- **Supabase PostgreSQL**: 메인 데이터베이스
- **Supabase Auth**: 회원 인증 (선택적)
- **Row Level Security (RLS)**: 데이터 접근 제어
- **Supabase Edge Functions**: 최소한의 사용
  - 가용성 오버랩 계산 (30분 단위 집계)
  - TTL 정리 작업 (Cron)

### 배포
- **Frontend**: Vercel
- **Backend/DB**: Supabase Free Plan

## 로컬 개발 환경 설정

### 필수 요구사항
- Node.js 18+ 
- npm 또는 yarn
- Supabase 계정

### 설치 및 실행

1. **의존성 설치**
```bash
npm install
```

2. **환경 변수 설정**
`.env` 파일을 생성하고 다음 내용을 추가하세요:
```
NUXT_PUBLIC_SUPABASE_URL=your_supabase_url
NUXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **데이터베이스 마이그레이션**
Supabase Dashboard의 SQL Editor에서 다음 순서로 마이그레이션을 실행하세요:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`
- `supabase/migrations/003_helper_functions.sql`

4. **Edge Functions 배포** (선택사항)
```bash
# Supabase CLI 설치 필요
supabase functions deploy availability-overlap
supabase functions deploy cleanup-expired-rooms
```

5. **개발 서버 실행**
```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 확인하세요.

## Supabase Free Plan 제한사항

- **데이터베이스 크기**: 500MB
- **월간 대역폭**: 5GB
- **Edge Functions 실행 시간**: 500,000 초/월
- **동시 연결 수**: 200개
- **RLS 정책**: 무제한

이 제한 내에서 운영하도록 설계되었습니다. 프로덕션 환경에서는 필요에 따라 유료 플랜으로 업그레이드하세요.

## 프로젝트 구조

```
meetly/
├── assets/           # CSS 및 정적 자산
├── components/       # Vue 컴포넌트
│   ├── TimeTab.vue
│   ├── PlacesTab.vue
│   ├── SummaryTab.vue
│   └── ExpensesTab.vue
├── composables/      # Vue Composables
│   ├── useSupabase.ts
│   ├── useParticipantToken.ts
│   └── useRoom.ts
├── pages/            # Nuxt 페이지
│   ├── index.vue
│   ├── create.vue
│   └── m/
│       └── [code].vue
├── supabase/
│   ├── migrations/   # 데이터베이스 마이그레이션
│   └── functions/    # Edge Functions
└── ARCHITECTURE.md   # 아키텍처 문서
```

## 주요 특징

- **모바일 우선**: 모든 UI가 모바일 환경을 우선으로 설계됨
- **익명 참여**: 회원가입 없이 participantToken으로 참여 가능
- **자동 정리**: TTL 정책에 따라 만료된 방 자동 삭제
- **투명성**: 모든 참여자가 데이터를 읽을 수 있음 (RLS 정책)
- **보안**: 참여자는 자신의 데이터만 수정 가능

## 라이선스

MIT
