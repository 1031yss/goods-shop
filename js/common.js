// 모든 페이지에서 공통으로 쓰는 기능
// supabase-js CDN과 config.js가 먼저 로드되어 있어야 한다.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 현재 로그인한 사용자 (없으면 null)
async function getUser() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

// 관리자 여부. 메뉴 표시용이고, 실제 데이터 보호는 DB의 RLS가 맡는다.
function isAdmin(user) {
  return user?.app_metadata?.role === "admin";
}

// 로그인이 필요한 페이지에서 호출. 로그인 안 했으면 로그인 페이지로 보낸다.
async function requireLogin() {
  const user = await getUser();
  if (user) return user;
  const here = location.pathname.split("/").pop() + location.search;
  location.href = "login.html?next=" + encodeURIComponent(here);
  return null;
}

// 테스트 안내와 상단 메뉴 그리기
async function renderHeader() {
  const user = await getUser();

  let links = '<a href="index.html">상품</a>';
  if (user) {
    links += '<a href="orders.html">내 결제 내역</a>';
    if (isAdmin(user)) links += '<a href="admin.html">관리자</a>';
    links += '<button type="button" id="logout-btn" class="nav-pill nav-logout">로그아웃</button>';
  } else {
    links += '<a href="login.html">로그인</a>';
    links += '<a href="login.html?mode=signup" class="nav-pill nav-signup">회원가입</a>';
  }

  document.body.insertAdjacentHTML("afterbegin", `
    <p class="test-notice">테스트 사이트입니다. 실제 결제와 배송은 없습니다.</p>
    <header class="site-header">
      <div class="header-inner">
        <a href="index.html" class="logo">굿즈샵</a>
        <nav class="nav-links" aria-label="주요 메뉴">${links}</nav>
      </div>
    </header>`);

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.href = "index.html";
    });
  }
}

// 12000 → "12,000원"
function won(n) {
  return Number(n || 0).toLocaleString("ko-KR") + "원";
}

// 날짜를 읽기 쉬운 형태로
function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

// 외부 값을 HTML에 넣을 때 안전하게 바꾸기
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

document.addEventListener("DOMContentLoaded", renderHeader);
