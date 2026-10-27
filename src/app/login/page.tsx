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
          Utilizador
          <input type="text" name="username" autoComplete="username" required />
          <span className="hint">3 a 30 carateres: letras, números, ponto, underscore ou hífen.</span>
        </label>
        <label>
          Palavra-passe
          <input type="password" name="password" autoComplete="current-password" required />
          <span className="hint">A palavra-passe da sua conta.</span>
        </label>
        {error ? <p className="err" role="alert">Utilizador ou palavra-passe inválidos.</p> : null}
        <div className="actions">
          <button type="submit" className="btn primary">Iniciar sessão</button>
        </div>
      </form>
    </main>
  );
}
