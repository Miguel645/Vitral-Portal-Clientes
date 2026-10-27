import ClientForm from "../ClientForm";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="narrow">
      <ClientForm title="Novo cliente" error={error} />
    </main>
  );
}
