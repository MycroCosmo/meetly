# Meetly

Meetly는 여러 사람이 **가능 시간, 장소 투표, 비용 분담**을 하나의 임시 모임방에서 정리할 수 있도록 만든 모바일 우선 일정 조율 서비스입니다.

핵심 조건은 회원가입을 강제하지 않고도 모임에 참여할 수 있게 하는 것이었습니다.

## 해결하려는 문제

실제 모임을 정할 때는 보통 세 가지를 따로 결정해야 합니다.

1. 언제 만날지
2. 어디서 만날지
3. 비용을 어떻게 나눌지

Meetly는 이 과정을 하나의 방 안에서 처리하고, 익명 참여자는 participant token으로 구분합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Nuxt 3, Vue 3, TypeScript |
| Database | Supabase PostgreSQL |
| Authorization | PostgreSQL Row Level Security |
| Server-side Job | Supabase Edge Functions |
| Deployment | Vercel, Supabase |

## 주요 기능

### 가능 시간 겹침 계산

참여자가 가능한 시간 범위를 입력하면 30분 단위 slot으로 정규화해 겹치는 인원 수를 계산합니다.

이를 통해 가장 많은 사람이 가능한 시간대를 일관된 방식으로 비교할 수 있도록 했습니다.

### 장소 투표

참여자가 장소 후보를 추가하고 투표할 수 있습니다.

방 생성자는 결과를 확인한 뒤 최종 장소를 확정할 수 있습니다.

### 비용 분담

비용 항목은 두 가지 방식으로 나눌 수 있습니다.

- 균등 분할
- 참여자별 직접 금액 입력

직접 입력 방식에서는 참여자별 금액 합계가 전체 비용과 일치하는지 검증합니다.

### 익명 참여

핵심 기능은 별도 회원가입 없이 이용할 수 있습니다.

participant token을 통해 방 내부 사용자를 구분하고, DB 접근 권한은 RLS 정책으로 제한합니다.

### 임시 데이터 정리

모임방은 영구적인 SNS 데이터가 아니라 일정 기간 사용 후 정리되는 데이터로 설계했습니다.

만료된 방은 scheduled Edge Function으로 정리하며, 한 번에 처리하는 대상을 제한해 하나의 실패가 전체 작업을 중단시키지 않도록 구성했습니다.

## 데이터와 권한 구조

주요 데이터:

- rooms
- participants
- availability blocks
- place candidates / votes
- expense items / shares

Supabase RLS를 이용해 협업에 필요한 조회는 허용하면서, 데이터 수정은 해당 참여자와 방의 맥락에 맞게 제한합니다.

## 프로젝트 구조

```text
meetly/
├── components/
├── composables/
├── pages/
├── supabase/
│   ├── migrations/
│   └── functions/
└── ARCHITECTURE.md
```

## 실행

```bash
npm install
npm run dev
```

Supabase URL과 anon key는 로컬 환경 변수로 설정합니다.

DB schema와 RLS policy는 `supabase/migrations`에서 관리합니다.

## 이 프로젝트에서 다룬 내용

- 일회성 협업 데이터 모델링
- PostgreSQL RLS 기반 권한 제어
- 회원가입 없는 익명 사용자 상태 관리
- 시간 slot 기반 일정 겹침 계산
- scheduled job을 이용한 임시 데이터 정리
