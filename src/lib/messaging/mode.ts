export type MessagingMode = "simulation" | "brevo" | "twilio";

// MESSAGING_MODE picks who sends the messages. Anything other than "brevo" or "twilio"
// (including a typo or no value) means simulation, so real SMS never go out by accident.
export function messagingMode(): MessagingMode {
  const mode = process.env.MESSAGING_MODE;
  return mode === "brevo" || mode === "twilio" ? mode : "simulation";
}

export function isSimulation(): boolean {
  return messagingMode() === "simulation";
}
