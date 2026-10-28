import ClientForm from "../ClientForm";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="page-medium">
      <ClientForm title="Novo cliente" error={error} />
    </main>
  );
}
