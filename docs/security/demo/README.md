# TechStride Demo — Consolidated Scan Feed

**Branch**: `demo-all-chains`
**Scan date**: 2026-07-23
**Purpose**: Single-folder feed for live Argus demo runs. All 5 demo chains active simultaneously.

## Demo Chains Active

| Chain | Description | Tools Required |
|---|---|---|
| 2 | SQLi via unauthenticated /search → full DB dump | Wiz Code + Burp Suite |
| 3 | JWT logged to stdout + GET /logs + DELETE /logs → credential harvest + anti-forensics | Wiz Code + Ionix |
| 5 | SSRF → IMDS → AWS credential theft → S3 exfil + SES phishing | Wiz Code + Wiz CSPM + Ionix |
| 9 | Mass assignment → admin → stored XSS → httpOnly false dismissal → PII exfil | Wiz Code + Burp Suite |
| 10 | Unpinned CI action reads ecs-task.tf → ACCESS_TOKEN_FALLBACK exfil → JWT forgery | Wiz Code + Semgrep |

## Feed Contents

| File | Source | Findings |
|---|---|---|
| `wiz-code.json` | phase-1 (OPEN) + phase-3 new + main CI/CD | 18 findings |
| `wiz-cspm.json` | phase-2 (SSRF + IAM + IMDS + WAF exclusion) | — |
| `burp.json` | phase-1 behavioral proofs + phase-3 XSS/errant vulns | 15 issues |
| `ionix.json` | phase-1 GET /logs probe + phase-2 IMDS probe | 12 findings |
| `semgrep.json` | main (unpinned action refs) | 6 refs |

## Key Design Notes

- Chain 2 (SQLi) is **OPEN** on this branch — the phase-2 parameterized query fix is NOT applied here
- Chain 3 DELETE /logs is **OPEN** — the phase-3 protect middleware fix is NOT applied here
- All chain findings are vendor-split AND: every chain requires Wiz + behavioral proof (Burp/Ionix) + model reasoning
- Wiz is one agent (Code + CSPM + Security Graph) — do not split into separate agents
- Errant vulns present in burp.json (IDOR, email enumeration, race condition, price manipulation) — Argus should NOT surface these as chains

## Running Against This Feed

Point Argus at `docs/security/demo/` as the scan feed directory.
The app code vulnerabilities are all present in `demo-all-chains` branch source.

## Phase Branches (for "We Fixed It" Story)

| Branch | What Changed |
|---|---|
| `dev/phase-1` | Chains 1-3 open, base app vulns |
| `dev/phase-2` | Chain 2 SQLi closed, Chain 4/5 appear |
| `dev/phase-3` | Chains 7-9 appear, DELETE /logs closed |
| `main` | Chain 10 CI/CD, latest prod snapshot |
| `demo-all-chains` | All 5 demo chains open simultaneously (this branch) |
