# Security Hardening — Changelog

## fix/api-security-hardening

Applied in response to findings from the 2026-07-18 scan cycle.

### Rate Limiting (addresses Semgrep TS-RATE-01, Snyk SNYK-JS-EXPR-1234)

- Added `express-rate-limit` middleware for all `/api/v1/*` routes (100 req/15min)
- Stricter limits on auth endpoints (10 req/15min)
- Order write endpoints rate-limited at 30 req/10min
- Implementation: `src/server/src/middleware/rate-limiter.ts`

### Security Headers (addresses Semgrep missing-noopener, CodeQL header-check)

- Helmet.js added with CSP, HSTS, X-Frame-Options, noSniff
- CSP configured for production asset sources
- HSTS preload enabled
- Implementation: `src/server/src/config/helmet.config.ts`

### Input Validation (addresses Snyk Code SNYK-JS-INPUT-5678)

- express-validator added for order creation, product search, order ID params
- UUID format enforcement on all ID parameters
- String length limits and character escaping on free-text fields
- Implementation: `src/server/src/middleware/input-validator.ts`

### What This Does Not Address

Rate limiting, headers, and input validation operate at the HTTP layer.
They address the findings the static analysis tools surfaced. Findings
related to data access patterns and authorization scope are tracked
separately and require application-layer changes outside the scope of
this hardening pass.
