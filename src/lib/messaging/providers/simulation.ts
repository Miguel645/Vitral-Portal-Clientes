import type { SmsProvider } from "../types";

// Sends nothing: the message is only written to the log, as "simulated".
export const simulationProvider: SmsProvider = {
  okStatus: "simulated",
  async send() {
    return { ok: true, providerId: null };
  },
};
