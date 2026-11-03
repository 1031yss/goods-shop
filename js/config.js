// 공개해도 되는 설정 값만 둔다.
// - anon 키: 브라우저용 공개 키. 실제 보안은 DB의 RLS 규칙이 담당한다.
// - 토스 클라이언트 키: 공개용 테스트 키 (시크릿 키는 Edge Function에만 있음)
const SUPABASE_URL = "https://cbsezulyzfwogeqedmjr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNic2V6dWx5emZ3b2dlcWVkbWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MzI5NTAsImV4cCI6MjEwOTIwODk1MH0.JDo5mYB1X_haBuK9bN1DyGT_4BqTYgDm_Gwz2f6J13o";
const TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
