// 모든 페이지에서 공통으로 쓰는 기능
// 사용 전 config.js와 supabase-js CDN이 먼저 로드되어 있어야 한다.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 현재 로그인한 사용자 (없으면 null)
async function getUser() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

// 관리자 여부: app_metadata.role === "admin"
function isAdmin(user) {
  return !!user && !!user.app_metadata && user.app_metadata.role === "admin";
}

// 로그인이 필요한 페이지에서 호출. 로그인 안 했으면 로그인 페이지로 보낸다.
async function requireLogin() {
  const user = await getUser();
  if (!user) {
    const here = location.pathname.split("/").pop() + location.search;
    location.href = "login.html?next=" + encodeURIComponent(here);
    return null;
  }
  return user;
}

// 상단 메뉴 그리기
async function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const user = await getUser();

  let links = '<a href="index.html">상품</a>';
  if (user) {
    links += '<a href="orders.html">내 결제 내역</a>';
    if (isAdmin(user)) links += '<a href="admin.html" class="nav-admin">관리자</a>';
    links += `<span class="nav-user">${escapeHtml(user.email)}</span>`;
    links += '<button type="button" id="logout-btn" class="btn-link">로그아웃</button>';
  } else {
    links += '<a href="login.html" class="nav-login">로그인 / 회원가입</a>';
  }

  nav.innerHTML = `
    <div class="nav-inner">
      <a href="index.html" class="logo">🛍️ 굿즈샵</a>
      <nav class="nav-links">${links}</nav>
    </div>`;

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

// 날짜를 "2026. 11. 3. 오후 3:20" 형태로
function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

const STATUS_LABEL = { pending: "결제 대기", paid: "결제 완료", failed: "결제 실패" };

function statusBadge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABEL[status] || status}</span>`;
}

// 사용자 입력을 HTML에 넣을 때 안전하게 바꾸기
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

document.addEventListener("DOMContentLoaded", renderNav);
