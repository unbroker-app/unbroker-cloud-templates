# n8n

Workflow automation you host yourself: connect 400+ apps and APIs, run code
steps, and build AI agents on a visual canvas.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **n8n** | `n8nio/n8n:2.44.1` | Public. Editor, webhooks and the API on one URL. 1 GiB volume for credentials files and community nodes |
| **db** | PostgreSQL 16 | Internal. Workflows, executions and users |

`N8N_ENCRYPTION_KEY` is generated for you. Every credential n8n stores is
encrypted with it, so **don't change or delete it**. If you lose it, the stored
credentials become unreadable.

## After deploy

1. Open the service URL. n8n asks you to create the **owner account**, and the
   first person to open the URL gets it, so do this right away.
2. Webhook URLs already point at the public address (`WEBHOOK_URL`). If you
   add a custom domain, update `WEBHOOK_URL` and `N8N_EDITOR_BASE_URL` to match.

## Notes

- Schedule and polling triggers run inside the n8n process, so keep the
  service running if you rely on them.
- Large workflows can need more memory. Raise the limit in the service's
  **Scale** tab.
