import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="narrow">
      <h1 style={{ marginBottom: 18 }}>Vitral clients</h1>
      <form action={login} className="card">
        <h2>Sign in</h2>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {error ? <p className="err" role="alert">The email or password is wrong. Try again.</p> : null}
        <div className="actions">
          <button type="submit" className="btn primary">Sign in</button>
        </div>
      </form>
    </main>
  );
}
