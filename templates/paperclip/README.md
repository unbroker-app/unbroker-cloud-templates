# Paperclip

Open-source orchestration for teams of AI agents. Set a company goal, hire
agents (Claude Code, Codex, Gemini, OpenCode or any HTTP/bash agent) into an
org chart, give them budgets, and track their work as tickets, all from one
dashboard.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Paperclip** | `ghcr.io/paperclipai/paperclip:2026.1012.0` | Public. Migrations run on boot. 10 GB volume for agent workspaces and data |
| **db** | PostgreSQL 16 | Internal. Companies, agents, tickets, budgets |

It runs in Paperclip's `authenticated` + `public` mode: everything requires
signing in.

## After deploy: claim the instance

Public Paperclip instances get their first admin through a **one-time invite
link**, not a setup page anyone could reach first:

1. Open the **Paperclip service's logs** and find the line
   `Claim this Paperclip instance (valid 72 hours): https://…/invite/pcp_bootstrap_…`.
2. Open that link, create your account, and accept the invite. You are now the
   instance admin.
3. Create your first company and hire agents.

The link works once. If it expires before you use it, restart the service: a new
one is printed (and the old one stops working). Once the instance has an
admin, nothing is printed.

## Good to know

- **Agents need model credentials.** Add your Anthropic, OpenAI or other API
  keys in Paperclip. They are encrypted with a key generated at deploy.
  Sign-ins made by the bundled CLIs are kept on the volume.
- Agents run **inside this container**, with its CPU and memory. The service
  starts with **2 GB and 1 CPU** (2 GB is the most memory a service can have). That is
  enough for a few agents at a time; upstream recommends 4 GB for more.
- Anyone who finds the URL can create an account, but an account sees nothing
  until an admin invites it to a company.
