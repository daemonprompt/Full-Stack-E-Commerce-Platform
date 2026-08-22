# Dependency Update Log

## fix/dependency-updates — 2026-07-29

### Updated packages

| Package | From | To | Finding |
|---------|------|----|---------|
| `jsonwebtoken` | 8.5.1 | 9.0.2 | Snyk OSS: weak default algorithm handling in 8.x |
| `axios` | 1.6.8 | 1.7.4 | Snyk OSS: SSRF via redirect follow in 1.6.x |
| `multer` | 1.4.4 | 1.4.5-lts.1 | Snyk OSS: path normalization in older versions |
| `express` | 4.18.2 | 4.19.2 | Snyk OSS: open redirect in static file serving |
| `@prisma/client` | 5.10.2 | 5.15.0 | Routine: performance and stability updates |

### Impact assessment

These updates address Snyk OSS findings from the 2026-07-18 scan.

The updated packages are used in:
- Authentication middleware (`jsonwebtoken`)
- Webhook delivery (`axios`)
- File upload handling (`multer`)
- Static asset serving (`express`)
- Database access (`@prisma/client`)

The application-layer issues identified in the security review are in
separate code paths and are not affected by these dependency versions.
The dependency updates close the Snyk OSS tickets without impacting
the application-layer review items.

### Verification

After update:
- `npm audit` reports 0 high/critical findings
- All existing tests pass
- Webhook delivery and file upload functions verified in staging
