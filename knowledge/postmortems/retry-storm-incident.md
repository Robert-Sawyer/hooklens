---
title: Retry storm incident
eventTypes: [subscription.cancelled, user.created]
---

# Retry storm incident

## Incident summary

An endpoint slowdown caused multiple delivery timeouts. Automatic retries ran
without a limit, increasing traffic to the already overloaded receiver.

## Root cause

The sender did not cap retry attempts and the receiver did not return a quick
acknowledgement before its long-running processing. Duplicate events also
caused repeated downstream work.

## Resolution and prevention

Retries were limited, delayed with backoff, and recorded in an audit log. The
receiver added idempotency handling and moved slow work behind an immediate
successful acknowledgement.
