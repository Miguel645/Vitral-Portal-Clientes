import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="narrow">
      <h1 style={{ marginBottom: 18 }}>Clientes Vitral</h1>
      <form action={login} className="card">
        <h2>Iniciar sessão</h2>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Palavra-passe
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {error ? <p className="err" role="alert">O email ou a palavra-passe estão errados. Tente novamente.</p> : null}
        <div className="actions">
          <button type="submit" className="btn primary">Iniciar sessão</button>
        </div>
      </form>
    </main>
  );
}
