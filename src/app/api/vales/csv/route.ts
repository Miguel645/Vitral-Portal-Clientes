import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";

export async function GET(request: NextRequest) {
  const promotionId = request.nextUrl.searchParams.get("promotion_id") ?? "";
  const since = request.nextUrl.searchParams.get("since") ?? "";

  if (!promotionId || !since) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("discount_codes")
    .select("code, percent, valid_from, valid_to")
    .eq("promotion_id", promotionId)
    .eq("kind", "promotion")
    .gte("created_at", since)
    .order("created_at");

  const rows = data ?? [];
  const header = "Codigo,Desconto,Valido de,Valido até\n";
  const body = rows
    .map((r) => `${r.code},${r.percent}%,${formatDate(r.valid_from)},${formatDate(r.valid_to)}`)
    .join("\n");

  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vales.csv"',
    },
  });
}
