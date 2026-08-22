# AI Code Review Integration

TechStride uses an AI-assisted code reviewer in CI to surface security concerns on pull requests.

## How it works

The workflow runs on every PR and processes:
- PR title and description
- Diff content
- Issue and comment context (when triggered via `/review` comment)

The reviewer posts inline comments and a summary comment on the PR.

## Permissions

The workflow requires:
- `pull-requests: write` — to post review comments
- `contents: read` — to access the diff
- `issues: read` — to read linked issue context

## Configuration

Set `ANTHROPIC_API_KEY` in repository secrets.
The reviewer model is configured in `.github/workflows/ai-security-review.yml`.

## Triggering

Automatic on PR open/sync. Manual trigger via `/review` comment on any issue.
