---
title: Subscription cancelled event
eventTypes: [subscription.cancelled]
---

# Subscription cancelled

## When the event is sent

`subscription.cancelled` is sent when a subscription ends immediately or when
its cancellation has taken effect at the end of the billing period.

## Delivery payload

The event includes `subscriptionId`, `customerId`, and `cancelAtPeriodEnd`.
Consumers should use the subscription identifier to make local updates
idempotently.

## Recommended consumer action

Disable access only after checking the cancellation state in the payload. A
consumer that receives the same event more than once must not create duplicate
refunds, invoices, or account changes.
