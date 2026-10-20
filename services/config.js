export const DEFAULT_PORT = 3000;

export function resolvePort(value) {
  if (value === null || value === undefined) return DEFAULT_PORT;

  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return DEFAULT_PORT;

  const port = Number(text);
  return port > 0 && port <= 65535 ? port : DEFAULT_PORT;
}
