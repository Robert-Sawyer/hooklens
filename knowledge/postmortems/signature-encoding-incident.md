---
title: Signature encoding incident
eventTypes: [payment.completed]
---

# Signature encoding incident

## Incident summary

Several `payment.completed` deliveries began returning `401 Invalid signature`
after a receiver deployment. The sender and receiver secrets were correct.

## Root cause

The receiver middleware parsed JSON and re-serialized the payload before HMAC
verification. The new representation changed whitespace and Unicode encoding,
so the calculated digest no longer matched the signature for the raw body.

## Resolution and prevention

The receiver captured the raw body before its JSON middleware and verified the
HMAC-SHA256 digest against those bytes. A regression test now rejects any
verification path that receives a parsed object instead of the raw payload.
