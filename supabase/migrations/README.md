# Supabase Migrations

이 디렉토리에는 Supabase 데이터베이스 마이그레이션 파일이 포함되어 있습니다.

## 마이그레이션 순서

1. **001_initial_schema.sql**: 기본 테이블 스키마 생성
2. **002_rls_policies.sql**: Row Level Security 정책 설정
3. **003_helper_functions.sql**: 유틸리티 함수들

## 적용 방법

### Supabase Dashboard 사용
1. Supabase 프로젝트 대시보드로 이동
2. SQL Editor 열기
3. 각 마이그레이션 파일을 순서대로 실행

### Supabase CLI 사용
```bash
supabase db push
```

## 주의사항

- 마이그레이션은 순서대로 실행해야 합니다
- 프로덕션 환경에서는 백업 후 실행하세요
- RLS 정책은 익명 사용자 접근을 허용하므로 보안을 신중히 검토하세요
