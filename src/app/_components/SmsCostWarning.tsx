import { nonGsm7Chars } from "@/lib/smsText";

// Shown when the text has characters that cut each SMS from 160 to 70 characters.
export default function SmsCostWarning({ text }: { text: string }) {
  if (nonGsm7Chars(text).length === 0) return null;
  return (
    <p className="err">
      Atenção: esta mensagem tem carateres que aumentam o custo do SMS: á, ã, õ, ó, í, ú, ê e ç. Letras como é, è, à
      e Ç não têm este problema.
    </p>
  );
}
