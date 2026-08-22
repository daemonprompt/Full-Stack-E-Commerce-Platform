# Jira API Access — Setup Guide

## Overview

This guide covers connecting each scan tool in this repository to Jira Cloud
for automated finding triage. The integration creates Jira issues for new
findings and closes them when a scan no longer reports the finding.

See `jira-config.yml` for field mappings and project settings.

---

## Step 1 — Create a Jira API Token

1. Log in to [Atlassian ID](https://id.atlassian.com)
2. Navigate to **Security** → **API tokens**
3. Click **Create API token**
4. Label the token `scan-integration-{repo-name}` for traceability
5. Copy the token — it is displayed once only

---

## Step 2 — Store Credentials in GitHub Actions Secrets

Navigate to **Settings → Secrets and variables → Actions** in this repository.
Add the following repository secrets:

| Secret | Value |
|--------|-------|
| `JIRA_URL` | Your Jira instance URL, e.g. `https://your-org.atlassian.net` |
| `JIRA_USER` | Email address of the API token owner |
| `JIRA_TOKEN` | API token from Step 1 |
| `JIRA_PROJECT` | Project key from `jira-config.yml` |

---

## Step 3 — Configure Scan Tool Integrations

### Checkov

Add to your scan workflow step:

```yaml
- name: Checkov scan
  uses: bridgecrewio/checkov-action@v12
  with:
    directory: terraform/
    output_format: junitxml
    output_file_path: reports/checkov.xml
    soft_fail: true

- name: Sync findings to Jira
  env:
    JIRA_URL: ${{ secrets.JIRA_URL }}
    JIRA_USER: ${{ secrets.JIRA_USER }}
    JIRA_TOKEN: ${{ secrets.JIRA_TOKEN }}
    JIRA_PROJECT: ${{ secrets.JIRA_PROJECT }}
  run: |
    python3 scripts/jira_sync.py \
      --tool checkov \
      --input reports/checkov.xml \
      --config docs/integrations/jira-config.yml
```

### Snyk IaC

```yaml
- name: Snyk IaC scan
  uses: snyk/actions/iac@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --report --project-name=${{ github.repository }}

- name: Sync Snyk findings to Jira
  run: |
    python3 scripts/jira_sync.py \
      --tool snyk-iac \
      --input snyk-iac-results.json \
      --config docs/integrations/jira-config.yml
```

### Wiz CSPM

Wiz Cloud integration pushes findings to Jira natively via the Wiz Automation
Rules engine. Configure the rule in the Wiz console:

1. Navigate to **Settings → Automation Rules**
2. Click **New Rule**
3. **Trigger:** Issue opened / Issue severity changed
4. **Filter:** Resource tag `Repository = {repo-name}`
5. **Action:** Create Jira issue
6. **Project:** Set to the project key in `jira-config.yml`
7. **Field mapping:** Match the `field_mappings` block in `jira-config.yml`

---

## Step 4 — Configure Jira Webhooks (Optional)

To receive status updates when Jira issues are resolved:

1. In Jira: **Settings → System → WebHooks**
2. Create a webhook pointing to your CI endpoint
3. Select events: **Issue updated**, **Issue resolved**
4. The CI system will mark the finding as resolved in the scan tool database

---

## Deduplication

The integration uses `dedup_key` from `jira-config.yml` to prevent duplicate
issues. When a scan run finds an existing finding, it updates the existing
issue rather than creating a new one.

For Wiz CSPM findings, Wiz manages deduplication internally via finding ID.

---

## GitHub API Access — Repository Scanning

To allow external systems to pull scan results from this repository via the
GitHub API:

### Read-Only Token (CI Integration)

```bash
# Create a fine-grained PAT with:
# - Repository: this repo only
# - Permissions: Contents (read), Metadata (read)
gh auth token  # retrieve current token
```

Required scopes for scan result access:
- `contents:read` — read scan result JSON files from `docs/security/`
- `metadata:read` — repository metadata

Store the token as `GITHUB_SCAN_READER_TOKEN` in the consuming system's
secrets store.

### Webhook — Push Scan Results on Commit

Configure a repository webhook to notify downstream systems when scan results
are updated:

1. **Settings → Webhooks → Add webhook**
2. **Payload URL:** Your SIEM or Jira sync endpoint
3. **Content type:** `application/json`
4. **Events:** Push (filter on `docs/security/**` paths)
5. **Secret:** Store as `GITHUB_WEBHOOK_SECRET` in the receiving system

---

## References

- [Atlassian API token docs](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
- [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Wiz Automation Rules](https://docs.wiz.io/wiz-docs/docs/automation-rules)
- [Checkov GitHub Action](https://github.com/bridgecrewio/checkov-action)
