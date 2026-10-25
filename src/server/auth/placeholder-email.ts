// Better Auth requires a unique email per user. Accounts created without one get an address on
// the reserved `.invalid` TLD (RFC 2606), which can never receive mail.

const DOMAIN = "no-email.rifada.invalid";

export function placeholderEmail(username: string): string {
  return `${username.toLowerCase()}@${DOMAIN}`;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.endsWith(`@${DOMAIN}`);
}
