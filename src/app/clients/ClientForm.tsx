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
    <main className="narrow">
      <form action={saveClient} className="card">
        <h2>{title}</h2>
        {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}
        <label>
          Name
          <input type="text" name="name" defaultValue={client?.name ?? ""} autoComplete="off" required />
        </label>
        <label>
          Mobile phone
          <input type="tel" name="phone" defaultValue={client?.phone ?? ""} placeholder="+351 912 345 678" autoComplete="off" required />
        </label>
        <label>
          Email (optional)
          <input type="email" name="email" defaultValue={client?.email ?? ""} autoComplete="off" />
        </label>
        <label>
          Birth date (optional)
          <input type="date" name="birth_date" defaultValue={client?.birth_date ?? ""} />
        </label>
        <label className="check">
          <input type="checkbox" name="consent" defaultChecked={client?.consent ?? false} />
          <span>This client agreed to receive promotions</span>
        </label>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="actions">
          {client?.id ? (
            <button type="submit" formAction={deleteClient} formNoValidate className="btn danger spacer">
              Delete client
            </button>
          ) : null}
          <Link className="btn" href="/">Cancel</Link>
          <button type="submit" className="btn primary">Save client</button>
        </div>
      </form>
    </main>
  );
}
