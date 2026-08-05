---
title: Endpoint timeout runbook
eventTypes: [payment.completed, subscription.cancelled, user.created]
---

# Endpoint timeout runbook

## Symptom

A delivery failed with a network timeout, HTTP `504`, or a response duration
near the configured timeout limit.

## Diagnostic steps

1. Check whether the destination endpoint was available at the delivery time.
2. Review the receiving service latency and database health.
3. Confirm that the receiver acknowledges the webhook before slow background
   processing starts.
4. Check for a retry storm that may have exhausted connection capacity.

## Safe next action

Retry only after the receiver has recovered. Use idempotent processing because
the receiver may have completed work even when its response timed out.
