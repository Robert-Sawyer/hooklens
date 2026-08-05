---
title: Webhook secret rotation
eventTypes: [payment.completed, subscription.cancelled, user.created]
---

# Webhook secret rotation

## Rotation window

When rotating a webhook secret, make the receiver accept both the old and the
new secret during a short overlap window. The sender should identify which
secret was used through a key identifier or controlled rollout schedule.

## Common failure mode

An endpoint can return `401 Invalid signature` immediately after rotation when
one side switched secrets before the other side. Verify the endpoint-specific
secret rather than a secret copied from another environment.

## Completion checklist

Confirm that recent deliveries are accepted with the new secret, remove the
old secret after the overlap window, and record the rotation in the integration
change log.
