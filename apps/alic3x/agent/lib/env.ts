export function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}
