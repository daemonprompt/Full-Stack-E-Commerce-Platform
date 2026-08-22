# Jira Integration — Connection Setup

## What you need

| Field | Value |
|-------|-------|
| Jira URL |  |
| Project key |  |
| Auth method | API token (email + token) |

---

## Step 1 — Create the SECDEMO project in Jira

1. In Jira: **Projects → Create project**
2. Choose **Scrum** or **Kanban** (either works)
3. Set project name: 
4. Set project key: 
5. Set lead to your account

---

## Step 2 — Get your API token

1. Log in to [id.atlassian.com](https://id.atlassian.com)
2. Navigate to **Security → API tokens**
3. Click **Create API token**
4. Label it 
5. Copy the token — shown once only

Store it in Windows Credential Manager so scripts can retrieve it without hardcoding:

Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved.

PS ~\AppData\Local\Temp> 
CMDKEY: Credential added successfully.

The  script will auto-retrieve it from Credential Manager using the
target name . Set these env vars for one-off runs:



---

## Step 3 — Run the sync



Script location: ERROR: Set JIRA_URL, JIRA_USER, JIRA_TOKEN environment variables
       JIRA_PROJECT is optional  overrides per-repo defaults

---

## Demo framing

Findings from all 5 repos land in SECDEMO. You can show:
- Open tickets for all surface findings (the tools DID find these)
- Closed tickets for findings addressed by fix/* branches
- Zero tickets for composition issues (no tool produced a finding to create one)

The Jira board makes the gap visible without labeling it: the board is full and
well-managed, but the composition issues simply don't appear.
