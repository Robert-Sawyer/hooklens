const SENSITIVE_FIELD_PATTERN =
  /authorization|api[-_]?key|token|secret|signature|password|cookie/i;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_VALUE_PATTERN = /\b(sk|rk|pk|whsec)_[A-Za-z0-9_-]+\b/gi;
const NAMED_VALUE_PATTERN =
  /\b(authorization|api[-_]?key|token|secret|signature|password|cookie)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi;

function redactText(value: string) {
  return value
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]")
    .replace(SECRET_VALUE_PATTERN, "[REDACTED]")
    .replace(NAMED_VALUE_PATTERN, "$1=[REDACTED]");
}

function redactValue(value: unknown, key?: string): unknown {
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

function redactUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid URL]";
  }
}

function redactAttempt(attempt: Record<string, unknown>) {
  return {
    ...attempt,
    responseBody:
      typeof attempt.responseBody === "string"
        ? redactText(attempt.responseBody)
        : attempt.responseBody,
  };
}

export function presentDelivery(delivery: Record<string, unknown>) {
  const event =
    delivery.event && typeof delivery.event === "object"
      ? (delivery.event as Record<string, unknown>)
      : null;

  return {
    ...delivery,
    targetUrl:
      typeof delivery.targetUrl === "string"
        ? redactUrl(delivery.targetUrl)
        : delivery.targetUrl,
    requestHeaders: redactValue(delivery.requestHeaders),
    lastResponseBody:
      typeof delivery.lastResponseBody === "string"
        ? redactText(delivery.lastResponseBody)
        : delivery.lastResponseBody,
    event: event
      ? {
          ...event,
          ...(Object.hasOwn(event, "payload")
            ? { payload: redactValue(event.payload) }
            : {}),
        }
      : delivery.event,
    attempts: Array.isArray(delivery.attempts)
      ? delivery.attempts.map((attempt) =>
          attempt && typeof attempt === "object"
            ? redactAttempt(attempt as Record<string, unknown>)
            : attempt,
        )
      : delivery.attempts,
  };
}
