export type MessagingMode = "simulation" | "twilio";

// MESSAGING_MODE picks who sends the messages. Anything other than "twilio"
// (including a typo or no value) means simulation, so real SMS never go out by accident.
export function messagingMode(): MessagingMode {
  return process.env.MESSAGING_MODE === "twilio" ? "twilio" : "simulation";
}

export function isSimulation(): boolean {
  return messagingMode() === "simulation";
}
