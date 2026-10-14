# Outline

A fast, collaborative knowledge base for your team: nested documents,
real-time editing, Markdown shortcuts, search, and integrations with Slack,
Figma, Linear and more.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Outline** | `outlinewiki/outline:1.11.0` | Public. Migrations run on boot. Uploads on a 5 GB volume |
| **db** | PostgreSQL 16 | Internal. Documents, users, history |
| **redis** | Redis 7 | Internal. Real-time collaboration and background jobs |

## Before you deploy: email

Outline signs people in with a **link sent by email**, so it needs an SMTP
server. Any transactional provider works (Resend, Postmark, Amazon SES,
Mailgun, your own). Have the host, port, credentials, and a verified sender
address ready for the deploy form.

## After deploy

The template creates the workspace on first boot with the **admin email** from
the deploy form, so nobody else can claim it. Open your Outline URL, enter that
email, and click the link you receive.

Invite your team from **Settings → Members**. To sign in with Google, Slack,
Microsoft or any OIDC provider instead of email links, add that provider's
variables (see [Outline's docs](https://docs.getoutline.com/s/hosting/doc/authentication-7ViKRmRY5o)).

## Good to know

- If Outline rejects the admin email or workspace name, the container stops and
  logs why, so the "create workspace" page never sits open. Fix the value and
  redeploy.
- `ADMIN_EMAIL`, `ADMIN_NAME` and `WORKSPACE_NAME` are only used on first boot.
- No sign-in email? Check the Outline service's logs: SMTP errors show up there.
  Port 465 needs `SMTP_SECURE=true`; 587 needs `false`.
