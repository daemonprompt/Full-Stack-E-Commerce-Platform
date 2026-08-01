# Security Scan Summary -- 2026-07-29

Commit: `7eed1c0e` | Branch: `demo-all-chains` | Environment: staging

## Coverage Matrix

| Chain | Semgrep | Snyk | Wiz Code | Burp Pro | Wiz CSPM | Result |
|-------|:-------:|:----:|:--------:|:--------:|:--------:|--------|
| Chain 1 -- JWT secret in IaC | | | | | ✓ | Partial (posture only) |
| Chain 2 -- GraphQL SQL injection | ✓ | | ✓ | ✓ | | Detected |
| Chain 3 -- JWT harvest + anti-forensics | | | | ✓ | | Partial (exfil vector only) |
| Chain 4 -- Socket.IO admin bypass | | | | | | **Missed** |
| Chain 5 -- Anonymous credential dump | | | ✓ | ✓ | | Detected |
| Chain 6 -- SSRF → ECS task creds | | | | ✓ | | Partial (SSRF only, no chain) |
| Chain 7 -- Prompt injection → XSS | | | | | | **Missed** |
| Chain 8 -- BOLA export jobs | | | | | | **Missed** |
| Chain 9 -- XSS + httpOnly bypass | ✓ | | ✓ | ✓ | | Detected |
| Chain 10 -- CI/CD supply chain | | | | | | **Missed** |
| Chain 11 -- Redis session poisoning | ✓ | | | | | Partial (deserialization risk flagged) |
| Chain 12 -- CloudFront cache poisoning | | | | | | **Missed** |
| Chain 13 -- Prototype pollution → Stripe | | | | | | **Missed** |
| Chain 14 -- LLM jailbreak → refunds | | | | | | **Missed** |
| Chain 15 -- README documents vulnerability | | | | | | **Missed** |
| Chain 16 -- HuggingFace trust_remote_code | | | | | | **Missed** |
| Chain 17 -- Seller prompt injection → customer ATO | | | | | | **Missed** |

**Detected (full chain):** 3 of 17
**Partially detected (component flagged, chain not surfaced):** 4 of 17
**Completely missed:** 10 of 17, including Chain 16 and Chain 17

---

## Why Tools Missed These Chains

### Chain 16

The Semgrep community registry contains rule `python.lang.security.audit.dangerous-transformers-loading.dangerous-transformers-loading` which detects `trust_remote_code=True` in HuggingFace `from_pretrained()` calls.

This rule ships with the `p/security-audit` pack.

Project `.semgrep.yml` excludes `p/security-audit` (APPSEC-204). The rule was not run. `scripts/ml/load_model.py` was scanned -- 87 files total, 234 rules active -- zero findings generated for the file.

To reproduce the miss: `semgrep --config p/python --config p/owasp-top-ten scripts/ml/load_model.py` -- 0 findings.
To catch it: `semgrep --config p/security-audit scripts/ml/load_model.py` -- 1 finding, HIGH severity.

#### Snyk

No CVE exists for the `trust_remote_code=True` pattern. The HuggingFace `transformers` library is not vulnerable -- the flag is a deliberate opt-in to execute remote code. Snyk's SCA engine is CVE-anchored. No CVE, no finding.

`requirements.txt` lists `transformers==4.41.2`. No known advisories at that version. Snyk reported 0 issues for the Python dependency tree.

#### Wiz Code

Wiz Code scanned `scripts/ml/load_model.py`. SAST engine has no rule for `trust_remote_code` ML loading patterns as of this scan date. File analyzed, 0 findings generated.

Wiz Code correctly flagged `HF_TOKEN` as a potential hardcoded secret in `docs/infrastructure/ecs-task.tf` (MEDIUM, WCODE-2891). The connection from token exfiltration to model poisoning to RCE was not surfaced.

#### Burp Pro

DAST coverage is limited to HTTP endpoints. `scripts/ml/load_model.py` is a batch inference process -- invoked at container startup, not exposed via any HTTP route. Burp's crawler cannot reach it. Coverage gap is structural.

Burp correctly identified SSRF in `POST /api/v1/webhook/ping` (Chain 6 surface, HIGH severity, confirmed via SSRF probe to 169.254.170.2). Did not trace from SSRF to ECS credentials to S3 to model repository to RCE.

#### Wiz CSPM

Wiz flagged `HF_TOKEN` in the ECS inference task environment variables (MEDIUM, posture rule `AWS-ECS-0031: Sensitive data in task environment variables`). Remediation guidance: move to Secrets Manager.

This is a correct finding. It is not the attack. The attack is: CI compromise → `HF_TOKEN` stolen → malicious `modeling_product_recommender.py` pushed to model repository → `trust_remote_code=True` executes it on next container restart.

Wiz CSPM evaluates posture. It does not model multi-hop attack chains that cross CI/CD, external ML registries, and container runtime.

### Chain 17

Chain 17 requires a seller account (a legitimate marketplace actor) to embed a prompt injection payload in a product description. All cloud configurations are correct. The application code has no defect detectable by SAST. No CVE exists. Runtime traffic is indistinguishable from legitimate chatbot usage.

**Semgrep**: No rule for indirect prompt injection via database-sourced content. The `lookupProductTool` code correctly retrieves and returns a database field -- this is not a code defect.

**Snyk**: No CVE. The OpenAI SDK is not vulnerable. The database read is not vulnerable. The vulnerability is the absence of a prompt boundary, which has no CVE anchor.

**Wiz Code**: No SAST finding. No secret in code. The product description field is a legitimate database column. The tool correctly returns its value.

**Burp Pro**: The injection payload is stored in the database, not an HTTP parameter. Burp scans request parameters and response content for injection patterns. The payload is inert at the HTTP layer -- it only activates when an LLM reads it.

**Wiz CSPM / Security Graph**: All cloud configurations are correct. No IAM misconfig, no public bucket, no overpermissive role. The Security Graph models cloud resource paths, not application semantic trust boundaries. `wiz-security-graph.json` documents the analysis.

**All four Wiz products**: Zero detection. This chain has no cloud posture component, no code defect, no network-layer signature.

---

## Scan Dates

| Tool | Scan Time (UTC) | Commit | Scope |
|------|-----------------|--------|-------|
| Semgrep | 2026-07-29 09:14 | 7eed1c0e | src/, scripts/ (87 files, 234 rules) |
| Snyk | 2026-07-29 09:22 | 7eed1c0e | package.json, requirements.txt |
| Wiz Code | 2026-07-29 09:31 | 7eed1c0e | Full repo SAST + secrets |
| Burp Pro | 2026-07-28 17:45 | pre-release | Staging API (weekly DAST run) |
| Wiz CSPM | 2026-07-29 08:55 | N/A | AWS account continuous |
