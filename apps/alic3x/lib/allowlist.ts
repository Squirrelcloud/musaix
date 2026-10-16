/**
 * ALIC3X_ALLOWED_EMAILS check. Comma-separated, case-insensitive. An empty list
 * allows everyone only outside production — in production it allows no one.
 */
export function emailAllowed(
  email: string | undefined,
  allowList: string | undefined,
  prod: boolean,
): boolean {
  const allowed = (allowList ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return !prod;
  return Boolean(email && allowed.includes(email.toLowerCase()));
}
