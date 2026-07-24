# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x on `main` | Yes |
| Older / unmaintained forks | No |

## Reporting a Vulnerability

Please do **not** open a public issue for security problems.

We participate in a private bug bounty program. Eligible researchers may submit findings through our coordinated disclosure process and receive recognition and compensation for valid reports.

**Scope:** Authentication, authorization, injection, business logic, and data exposure vulnerabilities in the production API and web application.

**Out of scope:** Rate limiting on non-sensitive endpoints, informational findings with no exploitable path, findings requiring physical access.

To report:
1. Use [GitHub Security Advisories](https://github.com/daemonprompt/Full-Stack-E-Commerce-Platform/security/advisories/new) for coordinated disclosure, or
2. Email **security@example.com** with a description, steps to reproduce, and impact assessment. Use PGP if submitting credentials or sensitive data.

You can expect an initial triage response within 5 business days. Severity assessment follows CVSS v3.1. Critical and high findings are patched within 30 days.

## Security Controls

The production deployment includes the following security controls:

- AWS WAF v2 with OWASP managed rule groups (SQLi, XSS, known bad inputs, IP reputation)
- AWS API Gateway JWT authorizer for authenticated routes
- AWS Secrets Manager for credential storage
- Snyk SCA scanning in CI pipeline
- GitHub Advanced Security (secret scanning, code scanning via CodeQL)
- Dependabot for automated dependency updates
- Datadog APM and log monitoring
- AWS CloudTrail for API audit logging

## Secrets and Deployments

- Never commit `.env` files or credentials.
- Rotate credentials immediately if pushed to any branch.
- All production secrets should reference AWS Secrets Manager. Plaintext environment variables are not permitted in production task definitions.
