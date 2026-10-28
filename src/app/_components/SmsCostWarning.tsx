import { nonGsm7Chars } from "@/lib/smsText";

// Shown under an SMS counter when the text has characters that cut each SMS from
// 160 to 70 characters. Names the characters found, so they're easy to replace.
export default function SmsCostWarning({ text }: { text: string }) {
  const chars = nonGsm7Chars(text);
  if (chars.length === 0) return null;
  return (
    <p className="err">
      Atenção: {chars.join(" ")} {chars.length === 1 ? "faz" : "fazem"} o SMS custar mais (70 em vez de 160 carateres
      por SMS). Isto acontece com á, ã, õ, ó, í, ú, ê e ç; letras como é, è, à e Ç não têm este problema.
    </p>
  );
}
