import Link from "next/link";
import { saveClient, deleteClient } from "../actions";

export type ClientValues = {
  id?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  birth_date?: string | null;
  consent?: boolean;
};

export default function ClientForm({
  title,
  client,
  error,
}: {
  title: string;
  client?: ClientValues;
  error?: string;
}) {
  return (
    <form action={saveClient} className="card">
      <h2>{title}</h2>
      {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}
      <label>
        Nome
        <input type="text" name="name" defaultValue={client?.name ?? ""} autoComplete="off" required />
        <span className="hint">O nome do cliente. Exemplo: &ldquo;Maria Silva&rdquo;.</span>
      </label>
      <label>
        Telemóvel
        <input type="tel" name="phone" defaultValue={client?.phone ?? ""} placeholder="+351 912 345 678" autoComplete="off" required />
        <span className="hint">Número português de 9 dígitos a começar por 9. Exemplo: 912 345 678.</span>
      </label>
      <label>
        Email (opcional)
        <input type="email" name="email" defaultValue={client?.email ?? ""} autoComplete="off" />
        <span className="hint">Exemplo: maria@exemplo.pt. Pode deixar em branco.</span>
      </label>
      <label>
        Data de nascimento (opcional)
        <input type="date" name="birth_date" defaultValue={client?.birth_date ?? ""} />
        <span className="hint">Usada para criar o vale de aniversário automaticamente.</span>
      </label>
      <label className="check">
        <input type="checkbox" name="consent" defaultChecked={client?.consent ?? false} />
        <span>Este cliente quer receber mensagens da Vitral (promoções, saldos e novidades)</span>
      </label>
      <p className="hint" style={{ marginTop: "calc(var(--sp-8) * -1)", marginBottom: "var(--sp-24)" }}>
        Só os clientes marcados aqui recebem SMS e vales de aniversário.
      </p>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className="actions">
        <Link className="btn" href="/">Cancelar</Link>
        <button type="submit" className="btn primary">Guardar cliente</button>
      </div>
      {client?.id ? (
        <div className="danger-zone">
          <button type="submit" formAction={deleteClient} formNoValidate className="btn danger">
            Eliminar cliente
          </button>
        </div>
      ) : null}
    </form>
  );
}
