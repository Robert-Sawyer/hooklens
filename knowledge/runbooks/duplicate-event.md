---
title: Duplicate event runbook
eventTypes: [payment.completed, subscription.cancelled, user.created]
---

# Duplicate event runbook

## Symptom

The receiving system reports an event was processed twice, or HookLens records
multiple attempts for the same event after a timeout or temporary failure.

## Diagnostic steps

1. Compare the event identifier and the business identifier across deliveries.
2. Check whether the receiver persisted an idempotency record before its side
   effect.
3. Review whether a timeout hid a successful first processing attempt.
4. Check retry configuration for too many immediate retries.

## Safe next action

Stop automatic retries if duplicate side effects are possible. Make the
receiver acknowledge known duplicates with a successful response after it has
verified the original processing result.
