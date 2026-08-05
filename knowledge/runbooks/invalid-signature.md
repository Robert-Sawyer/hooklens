---
title: Invalid signature runbook
eventTypes: [payment.completed, subscription.cancelled, user.created]
---

# Invalid signature runbook

## Symptom

A delivery failed with HTTP `401` or `403` and a response such as `Invalid
signature`, `Signature mismatch`, or `Unauthorized webhook`.

## Diagnostic steps

1. Confirm the endpoint is using the secret assigned to that environment.
2. Compare the active secret with the sender configuration after any rotation.
3. Confirm verification uses the raw request body before JSON parsing.
4. Confirm the receiver uses HMAC-SHA256 and the correct signature header.
5. Inspect middleware, proxies, and character encoding for payload changes.

## Safe next action

Do not retry repeatedly until the receiver configuration is corrected. After a
configuration change, request one controlled retry and verify the response.
