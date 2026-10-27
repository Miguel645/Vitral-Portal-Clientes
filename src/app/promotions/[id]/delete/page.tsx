import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
import { deletePromotion } from "../../actions";

export default async function DeletePromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: promotion } = await supabase
    .from("promotions")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!promotion) notFound();

  const { count } = await supabase
    .from("discount_codes")
    .select("id", { count: "exact", head: true })
    .eq("promotion_id", id);

  const codeCount = count ?? 0;

  return (
    <main className="narrow">
      <header className="top">
        <h1>Eliminar promoção</h1>
      </header>

      <TopNav current="promotions" />

      <div className="card">
        <h2>Tem a certeza?</h2>
        <p>
          Tem a certeza que quer eliminar a promoção <strong>&ldquo;{promotion.name}&rdquo;</strong>? Não é
          possível desfazer.
        </p>
        <p className="meta">
          Esta promoção já criou {codeCount} {codeCount === 1 ? "código" : "códigos"}. Esses códigos ficam
          guardados e continuam válidos normalmente.
        </p>
        <div className="confirm-actions">
          <Link href="/promotions" className="btn primary">Não, voltar</Link>
          <form action={deletePromotion}>
            <input type="hidden" name="id" value={promotion.id} />
            <input type="hidden" name="name" value={promotion.name} />
            <button type="submit" className="btn danger">Sim, eliminar</button>
          </form>
        </div>
      </div>
    </main>
  );
}
