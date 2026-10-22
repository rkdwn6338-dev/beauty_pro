# 뷰티 디테일 플래너 프로

뷰티 브랜드의 제품 브리프와 비공개 원본 자료를 관리하는 Next.js 웹서비스입니다.

## 구현 범위

- Supabase 이메일·비밀번호 로그인, 쿠키 세션 갱신, 로그아웃
- 기존 회사 소속 권한을 이용한 프로젝트 목록·등록
- 제품명·전성분 필수 검증, 7개 카테고리, 세부 품목 직접 입력
- 카테고리별 질문, 클렌징오일의 유화·헹굼·마무리 분리
- 기존 products.features JSON을 보존하며 브리프 저장
- 비공개 source-documents 버킷에 직접 업로드, 원본명·용량 자동 기록
- 20MiB 제한, 파일 시그니처·용량 서버 검증, 60초 다운로드 주소
- 파일 삭제 요청 처리 및 사용자 확인 화면. 기존 저장소 삭제 정책이 없어 기본 비활성화
- 모바일·데스크톱 화면과 브리프 체험 화면

AI 자료 분석, 근거 승인, 상세페이지 기획·디자인 생성은 아직 서비스에 연결하지 않았습니다. 성공한 것처럼 가짜 분석 결과를 표시하지 않습니다.

## 개발 실행

Node.js 24와 pnpm 11.25.0을 사용합니다.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# .env.local에 기존 Supabase의 공개용 키를 설정합니다.
pnpm dev
```

service_role 키를 사용하지 않습니다. 로그인한 사용자의 권한과 기존 RLS 정책으로 접근합니다. `.env.local`, `.vercel`, 사용자 보고서는 커밋하지 않습니다.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
node --env-file=.env.local scripts/live-supabase-check.mjs
```

브라우저 테스트는 설치된 Google Chrome을 사용합니다. 실제 계정 로그인·업로드의 통합 검증에는 회사 소속이 연결된 테스트 계정이 필요합니다. 공개 화면 테스트와 모의 API 테스트를 실제 계정 통합 테스트로 간주하지 않습니다.

## 기존 인프라 보존

Supabase 대상은 `xdgecsneoumhvjqfujcx`, Vercel 대상은 `prj_b8DMBCltq1TzhOBmBVNbkuXBDg4Y`입니다. 앱 실행과 빌드에 데이터베이스 생성·마이그레이션·시드 스크립트를 포함하지 않습니다. 기존 BREAKERS 프로젝트를 대상으로 작업하지 않습니다.

현재 회사·회원 등록 권한과 파일 삭제 정책은 클라이언트에 열려 있지 않습니다. 소속이 없는 사용자는 안내 화면만 보게 됩니다. 초기 사용자 등록 후 관리자가 회사 소속을 연결해야 합니다. 필요한 권한 추가안과 진행 상태는 [개발 현황](docs/개발현황.md)을 확인하세요.

## 배포

기존 프로젝트를 `.vercel/project.json`으로 연결하고 공개용 Supabase 환경변수 2개를 미리보기 환경에 설정한 뒤 `vercel deploy`를 실행합니다. `--prod`는 사용하지 않습니다. 자동 운영 배포를 막기 위해 깃 자동 배포는 기본 비활성화되어 있습니다.

삭제 기능은 검토한 정책을 적용하고 실계정 격리·삭제 테스트를 통과한 후 서버 환경변수 `ENABLE_SOURCE_DELETE=true`로 활성화합니다. 원본 삭제와 메타데이터 삭제는 서로 다른 시스템이므로 부분 실패가 생기면 관리자 정리가 필요합니다.
