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
      </label>
      <label>
        Telemóvel
        <input type="tel" name="phone" defaultValue={client?.phone ?? ""} placeholder="+351 912 345 678" autoComplete="off" required />
      </label>
      <label>
        Email (opcional)
        <input type="email" name="email" defaultValue={client?.email ?? ""} autoComplete="off" />
      </label>
      <label>
        Data de nascimento (opcional)
        <input type="date" name="birth_date" defaultValue={client?.birth_date ?? ""} />
      </label>
      <label className="check">
        <input type="checkbox" name="consent" defaultChecked={client?.consent ?? false} />
        <span>Este cliente aceitou receber promoções</span>
      </label>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className="actions">
        {client?.id ? (
          <button type="submit" formAction={deleteClient} formNoValidate className="btn danger spacer">
            Eliminar cliente
          </button>
        ) : null}
        <Link className="btn" href="/">Cancelar</Link>
        <button type="submit" className="btn primary">Guardar cliente</button>
      </div>
    </form>
  );
}
