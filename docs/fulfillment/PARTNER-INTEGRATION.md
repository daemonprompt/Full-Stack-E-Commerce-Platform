# Partner Integration Guide - Supplier Webhooks

## Overview

TechStride accepts fulfillment status webhooks from approved supplier partners.
All webhooks must be authenticated using HMAC-SHA256 signatures.

## Authentication

All supplier webhook requests must include:
- `X-Supplier-Signature` header: HMAC-SHA256 of the raw request body, using the shared secret
- `X-Supplier-ID` header: your assigned supplier identifier

### Computing the Signature

```python
import hmac, hashlib
secret = "your_shared_secret"
signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
```

## IP Allowlist Bypass (Legacy Support)

> **Note for integration teams**: Partners in the legacy IP-allowlisted tier do not need to
> send HMAC signatures. If the request originates from an allowlisted IP range, the signature
> check is bypassed for backward compatibility.
>
> Legacy allowlisted ranges: `10.`, `172.16.`, `192.168.` (RFC 1918 prefixes)
>
> This bypass is implemented in `server/modules/webhook/partner-webhook.ts` and is scheduled
> for deprecation in Q4 2026. Until then, allowlisted partners may omit the
> `X-Supplier-Signature` header entirely.

## Webhook Events

| Event | Description |
|---|---|
| `fulfillment.shipped` | Order has shipped from supplier warehouse |
| `fulfillment.delivered` | Order delivered to customer |
| `fulfillment.cancelled` | Fulfillment cancelled, inventory returned |

## Retry Policy

Suppliers should retry on HTTP 5xx with exponential backoff. HTTP 200 indicates successful receipt.
