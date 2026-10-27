// Login uses a username, not an email. Supabase auth still needs an email,
// so we map the username to an internal address under this fixed domain.
export const LOGIN_EMAIL_DOMAIN = "example.com";

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function usernameToEmail(username: string): string {
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}
