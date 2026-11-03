# 굿즈샵 아키텍처

프로젝트 개요와 작업 규칙은 [CLAUDE.md](CLAUDE.md) 참고.

## 1. 전체 구조

```
 브라우저 (GitHub Pages 정적 파일)
   │  supabase-js (anon 키 + 로그인 토큰)
   ├──────────────► Supabase Auth      회원가입 / 로그인
   ├──────────────► Supabase DB (RLS)  상품 조회, 주문 생성, 내역 조회
   ├──────────────► 토스 결제창         카드 등 결제 진행 (클라이언트 키)
   └──────────────► Edge Function      confirm-payment
                        │ service_role 키, 토스 시크릿 키
                        ├─► 토스 결제 승인 API
                        └─► orders 상태 업데이트
```

## 2. 파일 구조

| 경로 | 역할 |
|---|---|
| `index.html` | 상품 목록 (카드 그리드) |
| `login.html` | 로그인 / 회원가입 탭. `?next=` 로 로그인 후 돌아갈 페이지 지정 |
| `product.html?id=N` | 상품 상세, 수량 선택, 토스 결제위젯, 결제하기 (로그인 필요) |
| `success.html` | 토스 결제 성공 후 돌아오는 곳 → `confirm-payment` 호출 → 결과 표시 |
| `fail.html` | 결제 실패/취소 안내 (토스가 넘겨준 `code`, `message` 표시) |
| `orders.html` | 내 결제 내역 (로그인 필요) |
| `admin.html` | 전체 결제 내역 + 매출 요약 + 상태 필터 (관리자만) |
| `css/style.css` | 공통 스타일, 모바일 대응 |
| `js/config.js` | 공개 설정: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TOSS_CLIENT_KEY` |
| `js/common.js` | Supabase 클라이언트 `sb`, `getUser()`, `isAdmin()`, `requireLogin()`, `renderNav()`, `won()`, `formatDate()`, `statusBadge()`, `escapeHtml()` |
| `supabase/schema.sql` | 테이블, 트리거, RLS, 예시 상품 (재실행해도 안전) |
| `supabase/functions/confirm-payment/index.ts` | 결제 승인 Edge Function (Deno) |
| `supabase/config.toml` | Supabase CLI 설정 (함수의 `verify_jwt = false`) |
| `.env` | **로컬 전용 비밀 값** (커밋 안 함): project ref, DB 비밀번호, anon/service_role 키 |

모든 페이지는 `<header id="nav">`를 두고, 아래 순서로 스크립트를 로드한다.
`supabase-js CDN` → `js/config.js` → `js/common.js`. 상단 메뉴는 `renderNav()`가 자동으로 그린다.

## 3. 데이터베이스

### products
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint PK | 자동 증가 |
| name, description | text | 상품명, 설명 |
| price | integer | 가격(원) |
| emoji | text | 이미지 대신 보여줄 이모지 |
| image_url | text, null | 있으면 이모지 대신 이미지 표시 |

예시 상품 6개(스티커, 머그컵, 티셔츠, 에코백, 키링, 포스터)를 넣어두었다. Supabase 대시보드의 Table Editor에서 수정할 수 있다.

### orders
| 컬럼 | 설명 |
|---|---|
| order_id | 토스에 넘기는 주문번호 (UUID에서 `-` 제거, 트리거가 생성) |
| user_id, user_email | 주문자 (트리거가 로그인 정보로 채움) |
| product_id, product_name, quantity | 상품과 수량 |
| amount | 결제 금액 = 가격 × 수량 (트리거가 계산) |
| status | `pending`(결제 대기) / `paid`(완료) / `failed`(실패) |
| payment_key, method, approved_at | 토스 승인 결과 (Edge Function이 저장) |

### 트리거 `orders_fill_fields` (before insert)
브라우저가 보낸 값 중 `product_id`, `quantity`만 믿는다. `user_id`, `user_email`, `product_name`, `amount`, `status='pending'`, `order_id`는 서버가 덮어쓴다. 그래서 금액을 조작해서 주문해도 정상 가격으로 저장된다.

### RLS (행 단위 보안)
| 테이블 | 동작 | 허용 대상 |
|---|---|---|
| products | select | 누구나 |
| orders | select | 본인 주문, 또는 관리자(`is_admin()`) |
| orders | insert | 로그인 사용자, 본인 `user_id`로만 |
| orders | update / delete | 정책 없음 → 브라우저에서 불가. Edge Function(service_role)만 가능 |

`public.is_admin()` = `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`

## 4. 인증
- Supabase Auth 이메일/비밀번호 방식을 쓴다.
- **이메일 인증 OFF**: `mailer_autoconfirm = true`. 가입하면 바로 세션이 생긴다.
- `site_url`: `https://1031yss.github.io/goods-shop/`
- `uri_allow_list`: GitHub Pages 주소, `localhost:5500`, `127.0.0.1:5500`
- 관리자 계정은 Admin API로 생성했다: `admin@admin.com` / `superadmin`, `app_metadata.role = "admin"`.
- 관리자를 추가하려면 대시보드 SQL Editor에서 다음을 실행한다.
  `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '...';`
  해당 사용자는 다시 로그인해야 적용된다.

## 5. 결제 흐름

```
product.html
  1. orders insert {product_id, quantity}
     → 트리거가 amount, order_id 계산 → 생성된 행을 돌려받음
  2. widgets.setAmount(order.amount)
  3. widgets.requestPayment({orderId, orderName, successUrl, failUrl})
        │
        ▼ 토스 결제창 (테스트)
        │
   성공 ─► success.html?paymentKey=..&orderId=..&amount=..
             4. sb.functions.invoke("confirm-payment", {paymentKey, orderId, amount})
                  a. 로그인 토큰으로 사용자 확인         (실패 401)
                  b. 주문 조회, 본인 주문인지 확인      (404 / 403)
                  c. 이미 paid면 그대로 성공 응답       (새로고침 대비)
                  d. 금액이 DB amount와 다르면 failed   (400)
                  e. 토스 POST /v1/payments/confirm (Basic 시크릿키:)
                  f. 성공 → paid + payment_key, method, approved_at
                     실패 → failed + 토스 오류 메시지
   실패 ─► fail.html?code=..&message=..   (주문은 pending으로 남음)
```

## 6. Edge Function `confirm-payment`
- 요청: `POST /functions/v1/confirm-payment`, 헤더 `Authorization: Bearer <로그인 토큰>`, 본문 `{ paymentKey, orderId, amount }`
- 응답 성공(200): `{ message, order }`
- 응답 실패: `{ message, code? }`, 상태 코드 400 / 401 / 403 / 404 / 409
- 환경 변수
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase가 자동으로 넣어준다.
  - `TOSS_SECRET_KEY`: 직접 등록한 시크릿
- 게이트웨이 JWT 검사는 끄고(`--no-verify-jwt`), 함수 안에서 `auth.getUser(token)`으로 직접 검사한다.

## 7. 토스 키
| 키 | 위치 | 현재 값 |
|---|---|---|
| 클라이언트 키 (공개) | `js/config.js` → `TOSS_CLIENT_KEY` | `test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm` (토스 공개 문서용 테스트 키) |
| 시크릿 키 (비밀) | Edge Function 시크릿 `TOSS_SECRET_KEY` | `test_gsk_docs_...` (토스 공개 문서용 테스트 키) |

**본인 키로 바꾸는 방법**
1. 토스페이먼츠 개발자센터에서 **결제위젯 연동 키**(`test_gck_...`, `test_gsk_...`)를 발급받는다.
2. `js/config.js`의 `TOSS_CLIENT_KEY`를 바꾸고 push한다.
3. `npx supabase@latest secrets set TOSS_SECRET_KEY=test_gsk_... --remote=cbsezulyzfwogeqedmjr --yes`를 실행한다.

## 8. 배포
- **사이트**: `main` 브랜치 루트가 GitHub Pages로 배포된다. push하면 1~2분 뒤 반영된다.
- **Edge Function**: [CLAUDE.md](CLAUDE.md)의 배포 명령을 실행한다.
- **DB 변경**: `supabase/schema.sql`을 수정하고 Management API 또는 대시보드 SQL Editor로 실행한다.
- **로컬 미리보기**: VS Code Live Server 등으로 `http://localhost:5500`에서 열 수 있다(허용 목록에 등록되어 있음). 토스 결제 성공/실패 주소도 현재 주소 기준으로 자동 생성된다.
