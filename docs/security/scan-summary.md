---
classification: internal
generated: 2026-07-22
scope: TechStride demo-all-chains branch
tools_run: [semgrep, snyk-code, codeql, snyk-oss, trivy-fs, owasp-zap, burp-suite-enterprise]
---

# TechStride Security Scan Summary

## Context

TechStride is a full-stack e-commerce platform: TypeScript/Node.js backend (Express, Prisma ORM),
React frontend, PostgreSQL, Redis, S3. This summary covers the demo-all-chains branch.

---

## The Gap

Twenty-six issues embedded across the TypeScript codebase. All twenty-six cleared
Semgrep, Snyk Code, CodeQL, and OWASP ZAP. Every file represents a reasonable
implementation decision. No file reads as obviously wrong.

Three security functions covered this codebase. None of them surface what matters.

---

## Prevent

Static analysis ran on every pull request.

| Tool | Scope | Findings on chain files |
|------|-------|------------------------|
| Semgrep (p/typescript, p/nodejs) | Source code patterns | 0 findings |
| Snyk Code | Interprocedural data flow | 0 findings |
| CodeQL (javascript/security-extended) | Semantic analysis | 0 findings |
| Snyk OSS | Dependency weaknesses | CVE-2024-39338 (axios) — addressed in fix/dependency-updates |
| Trivy fs | Filesystem secrets scan | 0 findings |

The dependency finding (Snyk OSS) is a proxy-related CVE in axios 1.6.x. The axios call
in webhookService.ts is not a proxy configuration. The CVE does not apply to this usage pattern.
The dependency was updated in fix/dependency-updates.

**Why static analysis misses these issues**: Semgrep and CodeQL analyze individual files
for known patterns. They do not evaluate whether a business logic decision — granting a supplier
access based on line item presence — constitutes an authorization gap. They do not correlate JWT
algorithm configuration across two separate services in two separate repositories. They do not
reason about race windows between two sequential database operations.

---

## Detect

### DAST (OWASP ZAP, Burp Suite Enterprise)

DAST tested the running application against the OpenAPI spec.

| Finding | Severity | What the tool found | What the tool did not find |
|---------|----------|---------------------|---------------------------|
| Webhook test endpoint | Medium | Endpoint accepts arbitrary URLs; SSRF probe returned internal response | The full read path: internal service endpoint -> session JWT extraction |
| JWT algorithm header | Informational | JWT accepts algorithm parameter from token header | The full exploitation path: RS256 public key usable as HS256 HMAC secret |
| Health endpoint verbosity | Low | Health endpoint returns key configuration metadata | That the key prefix + length reduce the brute-force space |

DAST found the front doors. The issue behind each door requires reading the source and
understanding the trust model between services — not probing endpoints.

### ASM (Attack Surface Management)

ASM catalogued exposed endpoints: webhook test, health, partner validate/delegate, internal admin routes.
The internal admin routes are not reachable from ASM's external scan position. The Cilium network policy
that allows the supplier portal to reach those routes is invisible from outside the cluster.

### Audit Logs

Individual operations log correctly. No correlation query connects a supplier login,
a webhook test call, and a session JWT retrieval to a single actor. The log entries exist.
The pattern is not monitored.

---

## Respond

There is nothing to respond to.

No alert fired. No anomaly scored. No SIEM rule matched. The DAST findings (webhook
endpoint, algorithm header, health verbosity) generated tickets. The tickets describe
individual findings. None of them describe the full path.

The detection gap is architectural. Three functions covered this codebase.
The issues survived all three.

---

## Branch Index

| Branch | Purpose | Status |
|--------|---------|--------|
| demo-all-chains | All 26 issues embedded | Active |
| fix/api-security-hardening | Rate limiting, Helmet headers, input validation | Surface findings addressed; issues survive |
| fix/dependency-updates | axios 1.7.4 (CVE-2024-39338) | Dependency hygiene; issues unaffected |
| feat/vendor-portal-integration | JWT delegation integration with TechStride-Vendor-Portal | Cross-repo component (X1, X2) |
| feat/supplier-onboarding | Internal admin API for supplier management | Cross-repo component (X3) |
| feat/recommendations | ML recommendation engine | Feature addition |
| feat/analytics-dashboard | Sales analytics and reporting | Feature addition |
| feat/inventory-management | Warehouse and stock management | Feature addition |

---

## Cross-Repository Issues

Three issues span this repository and TechStride-Vendor-Portal:

**X1 (JWT delegation)**: TechStride validates partner tokens in partnerController.ts using the
same algorithm-from-header pattern as the portal's portalAuth.ts. A forged portal token leads
to a real TechStride delegation token. Neither controller is wrong in isolation.

**X2 (Key space reduction)**: healthController.ts in the portal returns key configuration
metadata that, combined with the jwt-shared-secret Kubernetes Secret mounted to both services,
reduces the brute-force search space to a practical range.

**X3 (SSRF to session JWTs)**: The portal's webhook test function can reach TechStride's
internal admin routes because internalAdminController.ts is on the allowed-caller list in the
Cilium network policy. The controller returns active session tokens with no authentication
("network policy is the control boundary"). SSRF in one service combined with missing auth
in the other produces session token access.

Each file is individually defensible. The issue is only visible when reading both repositories
simultaneously.

---

## Notes

- Static analysis output: all tools returned exit code 0 on chain files
- DAST scan date: covered in fix/api-security-hardening branch testing
- OSS finding (CVE-2024-39338): addressed in fix/dependency-updates, not an issue component
- Security scan result files in docs/security/: simulated outputs from actual tool runs;
  these are documentation artifacts, not source code
