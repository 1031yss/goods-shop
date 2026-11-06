// 공개해도 되는 값만 둔다.
// - anon 키: 브라우저용 공개 키. 실제 보안은 DB의 RLS 규칙이 맡는다.
// - 토스 클라이언트 키: 공개용 테스트 키. 시크릿 키는 Edge Function에만 있다.
const SUPABASE_URL = "https://hraayomocdutpycysifw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYWF5b21vY2R1dHB5Y3lzaWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDIzNjAsImV4cCI6MjEwOTQ3ODM2MH0.ghOozSMCxgckvRcvRjcUjxcJ7Fx82X5txsb3Pol8agk";
const TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
