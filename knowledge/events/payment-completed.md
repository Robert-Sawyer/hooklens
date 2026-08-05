---
title: Payment completed event
eventTypes: [payment.completed]
---

# Payment completed

## When the event is sent

`payment.completed` is sent after a payment is confirmed. Consumers should use
the payment identifier as their primary reference and treat the event as an
asynchronous notification, not as the source of truth for financial reporting.

## Delivery payload

The payload contains `paymentId`, `amount`, `currency`, and `customerId`.
Amounts are represented in the smallest currency unit. A consumer should fetch
the payment record if it requires information not present in the event.

## Signature verification

Verify the signature before parsing or transforming the request body. The HMAC
must be calculated from the exact raw bytes received from the webhook request.
See the Webhook signatures guide for the required headers and algorithm.
