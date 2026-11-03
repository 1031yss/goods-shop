-- 굿즈 쇼핑몰 DB 스키마
-- Supabase SQL Editor 또는 Management API(database/query)로 실행한다.
-- 여러 번 실행해도 안전하도록 작성했다.

-- ─────────────────────────────────────────
-- 1. 상품
-- ─────────────────────────────────────────
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  name        text    not null,
  description text    not null default '',
  price       integer not null check (price > 0),   -- 원 단위
  emoji       text    not null default '🎁',
  image_url   text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 2. 주문(결제 내역)
-- ─────────────────────────────────────────
create table if not exists public.orders (
  id           bigint generated always as identity primary key,
  order_id     text not null unique default replace(gen_random_uuid()::text, '-', ''), -- 토스에 넘기는 주문번호
  user_id      uuid not null references auth.users(id) on delete cascade,
  user_email   text,
  product_id   bigint not null references public.products(id),
  product_name text,
  quantity     integer not null default 1 check (quantity between 1 and 99),
  amount       integer not null default 0,           -- 결제 금액(원), 트리거가 계산
  status       text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payment_key  text,
  method       text,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);

-- ─────────────────────────────────────────
-- 3. 주문 생성 시 서버가 값을 강제로 채우는 트리거
--    (브라우저에서 금액을 조작해도 무시됨)
-- ─────────────────────────────────────────
create or replace function public.fill_order_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.products;
begin
  select * into p from public.products where id = new.product_id;
  if not found then
    raise exception '존재하지 않는 상품입니다';
  end if;

  new.user_id      := auth.uid();
  new.user_email   := auth.jwt() ->> 'email';
  new.product_name := p.name;
  new.amount       := p.price * new.quantity;
  new.status       := 'pending';
  new.payment_key  := null;
  new.method       := null;
  new.approved_at  := null;
  new.order_id     := replace(gen_random_uuid()::text, '-', '');
  return new;
end;
$$;

drop trigger if exists orders_fill_fields on public.orders;
create trigger orders_fill_fields
  before insert on public.orders
  for each row execute function public.fill_order_fields();

-- ─────────────────────────────────────────
-- 4. 보안 규칙(RLS)
-- ─────────────────────────────────────────
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- 관리자 판별: app_metadata.role = 'admin' (사용자가 스스로 바꿀 수 없는 값)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

drop policy if exists "products_select_all" on public.products;
create policy "products_select_all" on public.products
  for select using (true);

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert to authenticated
  with check (user_id = auth.uid());

-- update/delete 정책은 만들지 않는다 → 브라우저에서는 불가능.
-- 결제 승인 Edge Function이 service_role 키로만 상태를 바꾼다.

-- ─────────────────────────────────────────
-- 5. 예시 상품 (테이블이 비어 있을 때만)
-- ─────────────────────────────────────────
insert into public.products (name, description, price, emoji)
select * from (values
  ('홀로그램 스티커 세트', '반짝이는 홀로그램 스티커 10종 세트', 4500,  '✨'),
  ('캐릭터 머그컵',        '350ml 세라믹 머그컵, 전자레인지 사용 가능', 12000, '☕'),
  ('오버핏 티셔츠',        '면 100% 오버핏 반팔 티셔츠 (프리사이즈)', 29000, '👕'),
  ('캔버스 에코백',        '튼튼한 캔버스 소재 데일리 에코백', 18000, '👜'),
  ('아크릴 키링',          '양면 인쇄 아크릴 키링', 7000,  '🔑'),
  ('A3 아트 포스터',       '두꺼운 아트지에 인쇄한 A3 포스터', 15000, '🖼️')
) as v(name, description, price, emoji)
where not exists (select 1 from public.products);
