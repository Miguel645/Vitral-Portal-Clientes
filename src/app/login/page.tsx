import Notice from "@/app/_components/Notice";
import SubmitButton from "@/app/_components/SubmitButton";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const errProps = error ? { "aria-invalid": true, "aria-describedby": "login-err" } : {};

  return (
    <main className="page-narrow">
      <h1>Clientes Vitral</h1>
      <Notice message={message} />
      <form action={login} className="card">
        <h2>Iniciar sessão</h2>
        <label>
          Utilizador
          <input type="text" name="username" autoComplete="username" autoCapitalize="none" required {...errProps} />
        </label>
        <label>
          Palavra-passe
          <input type="password" name="password" autoComplete="current-password" required {...errProps} />
        </label>
        {error ? (
          <p className="err" id="login-err" role="alert">
            Utilizador ou palavra-passe incorretos. Verifique e tente novamente.
          </p>
        ) : null}
        <div className="actions">
          <SubmitButton pendingText="A entrar…">Iniciar sessão</SubmitButton>
        </div>
      </form>
    </main>
  );
}
