# 굿즈샵 (goods-shop)

굿즈를 판매하는 작은 쇼핑몰. 회원가입/로그인 → 상품 선택 → 토스페이먼츠 **테스트** 결제 → 결제 내역 확인, 관리자는 전체 결제 내역 조회.
세부 구조(파일, DB, 결제 흐름)는 [ARCH.md](ARCH.md) 참고.

## 사용자
- 코딩 입문자다. 질문하거나 결과를 설명할 때는 전문 용어를 풀어서, 입문자도 이해할 수 있게 설명한다.

## 기술 스택
- 프론트: **순수 HTML/CSS/JS** (빌드 도구·프레임워크 없음), GitHub Pages로 호스팅
- 백엔드: Supabase (Auth, Postgres + RLS, Edge Function)
- 결제: 토스페이먼츠 결제위젯 SDK v2, 테스트 모드
- 외부 라이브러리는 CDN으로 불러오고 버전을 고정한다 (`@supabase/supabase-js@2.45.4`)

## 주소와 계정
| 항목 | 값 |
|---|---|
| 사이트 | https://1031yss.github.io/goods-shop/ |
| GitHub 저장소 | https://github.com/1031yss/goods-shop (공개) |
| Supabase 프로젝트 | `goods-shop` / ref `cbsezulyzfwogeqedmjr` / 서울(ap-northeast-2) |
| Supabase 대시보드 | https://supabase.com/dashboard/project/cbsezulyzfwogeqedmjr |
| 관리자 계정 | `admin@admin.com` / `superadmin` |

## 꼭 지킬 규칙
- **비밀 값은 절대 커밋하지 않는다.** service_role 키, DB 비밀번호는 로컬 `.env`에만 있다(`.gitignore` 처리됨).
- 토스 **시크릿 키**는 Edge Function 시크릿(`TOSS_SECRET_KEY`)에만 둔다. 브라우저 코드에 넣지 않는다.
- `js/config.js`의 anon 키·토스 클라이언트 키는 공개용이라 커밋해도 된다. 데이터 보호는 RLS가 담당한다.
- 결제 금액은 브라우저를 믿지 않는다. 주문 금액은 DB 트리거가 계산하고, Edge Function이 토스 승인 전에 다시 검증한다.
- 관리자 판별은 `app_metadata.role = 'admin'`으로만 한다(사용자가 스스로 바꿀 수 없는 값).
- Supabase 이메일 인증은 꺼져 있다(`mailer_autoconfirm = true`). 가입 즉시 로그인된다.
- 페이지 간 링크는 상대 경로로 쓴다(`/goods-shop/` 하위 경로에서 동작해야 함).

## 자주 쓰는 명령 (PowerShell)
```powershell
# Supabase CLI 인증: 사용자 환경 변수 SUPABASE_ACCESS_TOKEN 사용
$env:SUPABASE_ACCESS_TOKEN = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User')

# 결제 승인 함수 배포
npx supabase@latest functions deploy confirm-payment --remote=cbsezulyzfwogeqedmjr --use-api --no-verify-jwt --yes

# 토스 시크릿 키 변경
npx supabase@latest secrets set TOSS_SECRET_KEY=<키> --remote=cbsezulyzfwogeqedmjr --yes

# DB 스키마 반영: supabase/schema.sql을 Management API /v1/projects/{ref}/database/query 로 실행 (여러 번 실행해도 안전)

# 사이트 배포: main 브랜치에 push 하면 GitHub Pages가 자동 배포
git push
```

## 테스트 결제 방법
상품 페이지 → 결제수단(카드 등) 선택 → 결제하기 → 결제창에서 아무 카드나 골라 진행. 테스트 키라서 실제 돈은 나가지 않는다.
