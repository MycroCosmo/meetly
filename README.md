# Meetly

여러 사람이 가능한 시간, 장소 후보와 비용 분담을 한 모임방에서 정리하는 Nuxt 3·Supabase 기반 서비스입니다. 회원가입을 강제하지 않는 참여 흐름을 목표로 만들었습니다.

## 구성

```text
Nuxt 3 / Vue 3 / TypeScript
  ├─ Supabase 테이블 조회·수정
  └─ Supabase Edge Functions
       └─ PostgreSQL / RLS 정책
```

주요 데이터는 방, 참여자, 가능 시간, 장소 후보·투표, 비용 항목·분담액입니다. SQL에는 30분 단위 시간 겹침 집계 함수가 있고, 클라이언트에는 방별 참여 토큰을 저장하고 사용하는 코드가 있습니다.

## 사용자 흐름

`useRoom.ts`는 `create-room` Edge Function으로 방과 방장 참여자를 생성하고, 응답받은 참여 토큰을 방별로 저장합니다. 시간·장소 확정도 토큰을 전달하는 Edge Function 경로를 사용합니다. 이 흐름과 클라이언트의 직접 DB 접근에 적용되는 RLS는 별도 권한 계층입니다.

## 권한 관련 현재 제한

RLS 정책이 있다는 사실만으로 모든 수정 권한이 검증된 것은 아닙니다.

- 저장소의 `002_rls_policies.sql`에는 소유자 ID가 없는 방의 수정·삭제를 허용하는 조건이 있습니다. 이 조건은 익명 방의 실제 방장을 구분하지 않습니다.
- 참여 토큰 컨텍스트를 별도 RPC로 설정한 뒤 다른 DB 요청에서 사용하는 코드가 있습니다. 실제 요청별 컨텍스트 전달과 정책 적용은 별도 검증이 필요합니다.
- 서비스 역할 키를 사용하는 Edge Function은 자체적인 요청자·방장 검증이 필요합니다. DB의 직접 접근 정책만 고쳐서 모든 함수가 안전해지는 것은 아닙니다.

따라서 현재 저장소 전체를 권한 검증 완료 상태로 소개하지 않습니다. 실제 운영 Supabase의 정책·함수·마이그레이션 상태는 저장소와 별도로 확인해야 합니다.

## 로컬 개발

저장소 루트에서 의존성을 설치합니다.

```bash
npm install
```

Supabase 프로젝트의 URL과 공개용 anon key를 로컬 `.env`에 설정합니다. 서비스 역할 키는 클라이언트 환경 변수에 넣지 않습니다.

```dotenv
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

```bash
npm run dev
```

화면 실행과 전체 기능 실행은 다릅니다. 방 생성·일정 확정 등의 기능을 사용하려면 해당 Supabase 프로젝트에 필요한 스키마·RLS·Edge Functions가 준비되어 있어야 합니다. [마이그레이션](supabase/migrations)과 [함수](supabase/functions)를 검토한 뒤 개발 환경에 적용하세요. 운영 DB에 SQL을 일괄 실행하는 방식은 권장하지 않습니다.

## 코드 확인 위치

- [모임방 흐름과 토큰 사용](composables/useRoom.ts)
- [Supabase 클라이언트](composables/useSupabase.ts)
- [현재 RLS 정책](supabase/migrations/002_rls_policies.sql)
- [시간 집계와 토큰 관련 SQL 함수](supabase/migrations/003_helper_functions.sql)
- [시간 확정 Edge Function](supabase/functions/finalize-time/index.ts)

## 검증해야 할 시나리오

방장과 다른 참여자가 같은 방을 수정하는 경우, 다른 방의 데이터 접근, 잘못된 토큰, 여러 HTTP 요청 사이의 토큰 컨텍스트, 만료 데이터 정리 실패를 구분해서 검사해야 합니다. 기능 코드·SQL·테스트의 존재와 실제 운영 환경의 통과 결과를 구분해 관리합니다.
