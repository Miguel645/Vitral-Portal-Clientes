"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  // An empty box gets its message under that box; any other failure gets the one
  // generic message under both, so it never says which part was wrong.
  const userErr = state.error && state.field !== "password" ? state.error : undefined;
  const passErr = state.error && state.field !== "username" ? state.error : undefined;
  const generic = state.error && !state.field;

  return (
    <form action={formAction} className="card" key={JSON.stringify(state)} noValidate>
      <h2>Iniciar sessão</h2>
      <label htmlFor="username">
        Utilizador
        <input
          id="username"
          type="text"
          name="username"
          defaultValue={state.username ?? ""}
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus={!!userErr && !generic}
          aria-invalid={!!userErr}
          aria-describedby={userErr && !generic ? "username-err" : generic ? "login-err" : undefined}
        />
        {userErr && !generic ? <span className="err" id="username-err" role="alert">{userErr}</span> : null}
      </label>
      <label htmlFor="password">
        Palavra-passe
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          autoFocus={!!passErr}
          aria-invalid={!!passErr}
          aria-describedby={passErr && !generic ? "password-err" : generic ? "login-err" : undefined}
        />
        {passErr && !generic ? <span className="err" id="password-err" role="alert">{passErr}</span> : null}
      </label>
      {generic ? (
        <p className="err" id="login-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "A entrar…" : "Iniciar sessão"}
        </button>
      </div>
    </form>
  );
}
