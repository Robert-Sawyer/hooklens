---
title: User created event
eventTypes: [user.created]
---

# User created

## When the event is sent

`user.created` is emitted after a new user account is persisted. It can be
used to provision an account in a connected CRM or analytics system.

## Delivery payload

The payload contains a stable `userId` and an email address. Do not use email
as the idempotency key because the user can later change it.

## Consumer guidance

Store the event identifier or user identifier before performing downstream
side effects. This lets the receiving system safely ignore a duplicate event.
