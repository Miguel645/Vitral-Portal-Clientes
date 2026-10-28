import Notice from "@/app/_components/Notice";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="page-narrow">
      <h1>Clientes Vitral</h1>
      <Notice message={message} />
      <LoginForm />
    </main>
  );
}
