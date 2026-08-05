---
title: Webhook signatures
eventTypes: [payment.completed, subscription.cancelled, user.created]
---

# Webhook signatures

## Signing algorithm

HookLens examples use HMAC-SHA256. The sender creates a digest from the raw
HTTP request body and the active webhook secret, then sends it in the
`x-hooklens-signature` header.

## Raw payload verification

Calculate the expected signature from the unmodified request body. Parsing JSON
and serializing it again can change whitespace, key order, or character
encoding. A signature calculated from processed JSON will not match a
signature calculated from the original bytes.

## Comparing signatures

Use a timing-safe comparison after checking that both signatures have a valid
format and the same length. Reject requests with a missing signature, an
unknown secret, or an invalid digest.

## Debugging invalid signatures

Check the active secret, the raw body capture, the selected HMAC algorithm,
and any proxy or middleware that can alter the payload. Do not log webhook
secrets or a complete Authorization header while diagnosing the issue.
