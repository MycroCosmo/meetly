# Meetly 아키텍처 문서

## 개요

Meetly는 When2Meet 스타일의 그룹 스케줄링 웹 애플리케이션으로, 여행 및 미팅을 위한 확장 기능을 제공합니다. 모바일 우선 설계로 링크 기반 접근을 통해 앱 설치 없이 사용할 수 있습니다.

## When2Meet 확장 이유

When2Meet는 가용성 오버랩에 초점을 맞춘 훌륭한 도구이지만, 실제 그룹 모임을 계획할 때는 다음과 같은 추가 기능이 필요합니다:

1. **장소 결정**: 시간만으로는 부족하며, 어디서 만날지 결정해야 합니다.
2. **비용 분할**: 여행이나 모임에서 공동 비용을 투명하게 분할해야 합니다.
3. **익명 참여자 지원**: 회원가입 없이도 참여할 수 있어야 합니다.
4. **TTL 관리**: 일시적인 모임을 위한 자동 정리 기능이 필요합니다.

## 전체 사용자 플로우

### 1. 방 생성 (Create)
- 사용자가 `/create` 페이지에서 새 모임을 생성
- 제목, 설명 입력
- 로그인 사용자: 자동으로 owner로 설정, 90일 TTL
- 익명 사용자: participantToken 생성, 72시간 TTL
- 고유한 방 코드 생성 (예: `abc123`)

### 2. 가용성 제출 (Time)
- 참여자가 `/m/[code]` 페이지의 Time 탭에서 가용성 블록 추가
- 날짜 + 시작 시간 + 종료 시간 입력
- 자신의 가용성 블록 목록 표시
- 상위 오버랩 시간 범위 자동 계산 및 표시 (30분 단위)

### 3. 장소 투표 (Places)
- 참여자가 장소 후보 추가 (이름, 주소, 좌표)
- 각 참여자는 1표 투표 가능
- 투표 수 실시간 표시
- 방 소유자만 최종 장소 확정 가능

### 4. 요약 (Summary)
- 확정된 시간 및 장소 표시
- 공유 가능한 텍스트 블록 생성 (클립보드 복사)
- 예: "2024년 4월 15일 14:00-16:00, 서울역 앞 스타벅스"

### 5. 비용 분할 (Expenses)
- 비용 항목 추가 (제목, 총액, 지불자)
- 분할 유형 선택:
  - EQUAL: 자동으로 1/n 계산
  - CUSTOM: 참여자별 수동 금액 입력 (합계 검증)
- 각 참여자의 부담 금액 표시

## 데이터 소유권 규칙

### 방 (Rooms)
- `owner_user_id`가 있으면 로그인 사용자가 소유
- `owner_user_id`가 null이면 익명 방
- 소유자만 `finalized_time_start`, `finalized_time_end`, `finalized_place_id` 수정 가능

### 참여자 (Participants)
- 익명 참여자는 `participantToken`으로 식별
- 토큰은 클라이언트에 저장 (localStorage 또는 cookie)
- DB에는 해시된 토큰만 저장 (`token_hash`)
- 참여자는 자신의 닉네임만 수정 가능

### 가용성 블록 (Availability Blocks)
- 참여자는 자신의 가용성 블록만 추가/수정/삭제 가능
- RLS로 강제

### 장소 후보 (Place Candidates)
- 모든 참여자가 추가 가능
- 생성자 정보 저장 (`created_by_participant_id`)

### 장소 투표 (Place Votes)
- 참여자는 방당 1표만 투표 가능
- 자신의 투표만 수정/삭제 가능
- UNIQUE 제약조건으로 강제

### 비용 항목 (Expense Items)
- 모든 참여자가 추가 가능
- 지불자 정보 저장 (`payer_participant_id`)

### 비용 분할 (Expense Shares)
- CUSTOM 분할의 경우 합계 검증 필요
- API 로직 또는 트리거로 검증

## TTL 규칙

### 익명 방 (Anonymous Rooms)
- `owner_user_id`가 null
- `expire_at` = `created_at + 72 hours`
- 만료 시 방 및 모든 하위 데이터 자동 삭제

### 회원 방 (Member Rooms)
- `owner_user_id`가 존재
- `expire_at` = `created_at + 90 days` (설정 가능)
- 만료 시 방 및 모든 하위 데이터 자동 삭제

### TTL 정리 작업
- Supabase Edge Function으로 구현
- Cron 트리거로 매시간 실행
- `expire_at < NOW()`인 방 삭제
- CASCADE 삭제로 모든 하위 데이터 자동 정리

## 주요 페이지/라우트

### `/create`
- 방 생성 페이지
- 제목, 설명 입력 폼
- 생성 후 `/m/[code]`로 리다이렉트

### `/m/[code]`
- 메인 모임 페이지
- 하단 탭 네비게이션:
  1. **Time**: 가용성 관리 및 오버랩 표시
  2. **Places**: 장소 후보 및 투표
  3. **Summary**: 확정 정보 및 공유
  4. **Expenses**: 비용 분할 관리

### 인증
- Supabase Auth 사용 (선택적)
- 익명 참여자는 participantToken만 사용
- 로그인 사용자는 JWT 토큰 사용

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

## 보안 고려사항

1. **익명 참여자 토큰**
   - 클라이언트에서 UUID 생성
   - DB 저장 전 해시 처리 (bcrypt 또는 SHA-256)
   - 토큰 매칭 시 해시 비교

2. **RLS 정책**
   - 참여자는 자신의 데이터만 수정
   - 방 소유자만 확정 정보 수정
   - 모든 참여자는 읽기 가능 (투명성)

3. **입력 검증**
   - 클라이언트 및 서버 양쪽에서 검증
   - SQL 인젝션 방지 (Supabase 클라이언트 사용)
   - XSS 방지 (Vue의 자동 이스케이프)

## 확장 가능성

- Supabase Free Plan 제한 내에서 운영
- 필요 시 Edge Functions 추가 가능
- 복잡한 MSA나 Kafka 같은 인프라는 불필요
- 단순성과 유지보수성 우선
