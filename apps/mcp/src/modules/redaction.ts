const SENSITIVE_FIELD_PATTERN =
  /authorization|api[-_]?key|token|secret|signature|password|cookie/i;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_VALUE_PATTERN = /\b(sk|rk|pk|whsec)_[A-Za-z0-9_-]+\b/gi;
const NAMED_VALUE_PATTERN =
  /\b(authorization|api[-_]?key|token|secret|signature|password|cookie)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi;

export function redactText(value: string) {
  return value
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]")
    .replace(SECRET_VALUE_PATTERN, "[REDACTED]")
    .replace(NAMED_VALUE_PATTERN, "$1=[REDACTED]");
}

export function redactValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_FIELD_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

export function redactUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid URL]";
  }
}
