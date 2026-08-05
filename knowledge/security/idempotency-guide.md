---
title: Idempotency guide
eventTypes: [payment.completed, subscription.cancelled, user.created]
---

# Idempotency guide

## Why duplicate events happen

Network failures can leave a sender uncertain whether a receiver processed a
request. Retrying is therefore normal, and receivers can see the same event
more than once.

## Safe processing pattern

Store an event identifier or business identifier before applying a side effect.
If the identifier already exists, return a successful response without creating
another record, refund, or notification.

## Retry response

Return a successful status for a known duplicate when the original operation
was completed. Returning an error for a safely ignored duplicate can cause the
sender to retry repeatedly.
