import ClientForm from "../ClientForm";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ClientForm title="Novo cliente" error={error} />;
}
