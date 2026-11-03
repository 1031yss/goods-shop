// 결제 승인 Edge Function
// 토스 결제창에서 돌아온 success.html이 호출한다.
// 토스 시크릿 키는 여기(서버)에만 있고 브라우저에는 절대 노출되지 않는다.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ message: "POST만 허용됩니다" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const tossSecretKey = Deno.env.get("TOSS_SECRET_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. 로그인한 사용자 확인
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ message: "로그인이 필요합니다" }, 401);
  const user = userData.user;

  // 2. 요청 값 읽기
  let paymentKey: string, orderId: string, amount: number;
  try {
    ({ paymentKey, orderId, amount } = await req.json());
    amount = Number(amount);
  } catch {
    return json({ message: "잘못된 요청입니다" }, 400);
  }
  if (!paymentKey || !orderId || !amount) return json({ message: "결제 정보가 부족합니다" }, 400);

  // 3. DB의 주문과 비교해서 검증
  const { data: order } = await admin.from("orders").select("*").eq("order_id", orderId).maybeSingle();
  if (!order) return json({ message: "주문을 찾을 수 없습니다" }, 404);
  if (order.user_id !== user.id) return json({ message: "본인 주문이 아닙니다" }, 403);
  if (order.status === "paid") return json({ message: "이미 결제가 완료된 주문입니다", order });
  if (order.status !== "pending") return json({ message: "처리할 수 없는 주문 상태입니다" }, 409);
  if (order.amount !== amount) {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return json({ message: "결제 금액이 주문 금액과 다릅니다" }, 400);
  }

  // 4. 토스페이먼츠에 결제 승인 요청
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(tossSecretKey + ":"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const toss = await tossRes.json();

  // 5. 결과를 DB에 저장
  if (!tossRes.ok) {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return json({ message: toss.message ?? "결제 승인에 실패했습니다", code: toss.code }, 400);
  }

  const { data: updated } = await admin
    .from("orders")
    .update({
      status: "paid",
      payment_key: toss.paymentKey,
      method: toss.method,
      approved_at: toss.approvedAt,
    })
    .eq("id", order.id)
    .select()
    .single();

  return json({ message: "결제가 완료되었습니다", order: updated });
});
