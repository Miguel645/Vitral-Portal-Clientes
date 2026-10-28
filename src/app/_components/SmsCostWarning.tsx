import { countSmsParts, nonGsm7Chars } from "@/lib/smsText";

// Shown when the message costs more than one plain SMS: it has characters that cut
// each SMS from 160 to 70 characters, and/or it's too long for one SMS.
export default function SmsCostWarning({ text }: { text: string }) {
  const accents = nonGsm7Chars(text).length > 0;
  const { length, gsm7, parts } = countSmsParts(text);
  if (!accents && parts <= 1) return null;
  return (
    <>
      {accents ? (
        <p className="err">
          Atenção: esta mensagem tem carateres que aumentam o custo do SMS: á, ã, õ, ó, í, ú, ê e ç. Letras como é, è, à
          e Ç não têm este problema.
        </p>
      ) : null}
      {parts > 1 ? (
        <p className="err">
          Atenção: esta mensagem tem {length} carateres e passa o limite de {gsm7 ? 160 : 70} de um SMS, por isso cada
          cliente vai receber {parts} SMS (custa {parts} vezes mais).
        </p>
      ) : null}
    </>
  );
}
