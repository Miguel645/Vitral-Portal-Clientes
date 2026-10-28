import { describe, expect, it } from "vitest";
import { composeCampaignMessage, composeValeMessage, countSmsParts, removeAccents } from "./smsText";

describe("countSmsParts", () => {
  it("counts nothing for an empty text", () => {
    expect(countSmsParts("").parts).toBe(0);
  });

  it("fits 160 GSM-7 characters in one SMS, then splits into parts of 153", () => {
    expect(countSmsParts("a".repeat(160))).toMatchObject({ gsm7: true, length: 160, parts: 1 });
    expect(countSmsParts("a".repeat(161))).toMatchObject({ parts: 2, segmentSize: 153 });
    expect(countSmsParts("a".repeat(306)).parts).toBe(2);
    expect(countSmsParts("a".repeat(307)).parts).toBe(3);
  });

  it("counts € and other extension characters as 2", () => {
    expect(countSmsParts("5€").length).toBe(3);
    expect(countSmsParts("€".repeat(80))).toMatchObject({ gsm7: true, length: 160, parts: 1 });
    expect(countSmsParts("€".repeat(81)).parts).toBe(2);
  });

  it("keeps é, à and Ç in the cheap set", () => {
    expect(countSmsParts("Parabéns, Ç à").gsm7).toBe(true);
  });

  it("switches to 70 / 67 characters when a letter like ã is used", () => {
    expect(countSmsParts("ã" + "a".repeat(69))).toMatchObject({ gsm7: false, parts: 1, segmentSize: 70 });
    expect(countSmsParts("ã" + "a".repeat(70))).toMatchObject({ gsm7: false, parts: 2, segmentSize: 67 });
  });
});

describe("removeAccents", () => {
  it("swaps the expensive accents for plain letters", () => {
    expect(removeAccents("Promoção até sábado à tarde")).toBe("Promocao até sabado à tarde");
  });

  it("swaps typographic quotes and dashes", () => {
    expect(removeAccents("“Vitral” – já…")).toBe('"Vitral" - ja...');
  });

  it("leaves text that is already cheap as it is", () => {
    const text = "Bom dia Maria! Tem um vale de 10% na Vitral.";
    expect(removeAccents(text)).toBe(text);
  });

  it("makes the text GSM-7 when every character has a plain version", () => {
    expect(countSmsParts(removeAccents("Olá João, ótima promoção!")).gsm7).toBe(true);
  });
});

describe("composeCampaignMessage", () => {
  it("fills in {nome} and {vale} and adds the unsubscribe link", () => {
    expect(
      composeCampaignMessage("Olá {nome}, o seu vale: {vale}. {nome}!", { firstName: "Ana", vale: "ABCD2345" }, "https://vitral.pt/", "tok12345")
    ).toBe("Olá Ana, o seu vale: ABCD2345. Ana!\nPara deixar de receber mensagens: https://vitral.pt/u/tok12345");
  });

  it("leaves the link out when it's switched off", () => {
    expect(composeCampaignMessage("Olá {nome}", { firstName: "Ana", vale: "" }, null, "tok12345")).toBe("Olá Ana");
  });
});

describe("composeValeMessage", () => {
  const v = { firstName: "Rui", codes: ["ABCD2345", "EFGH6789"], discount: "10%", validTo: "31/12/2026" };

  it("fills in every placeholder, joining several codes with commas", () => {
    expect(
      composeValeMessage("Bom dia {{name}}! {{desconto}}: {{codigo}} até {{validade}}.", v, "https://vitral.pt", "tok12345")
    ).toBe("Bom dia Rui! 10%: ABCD2345, EFGH6789 até 31/12/2026.\nPara deixar de receber mensagens: https://vitral.pt/u/tok12345");
  });

  it("leaves the link out when it's switched off", () => {
    expect(composeValeMessage("{{codigo}}", { ...v, codes: ["ABCD2345"] }, null, "tok12345")).toBe("ABCD2345");
  });
});
