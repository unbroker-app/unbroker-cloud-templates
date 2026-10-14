# Chatwoot

Open-source customer engagement: one shared inbox for website live chat,
email, WhatsApp, Instagram, Facebook, Telegram, SMS and an API channel, with
assignments, canned responses, reports, a help center and the Captain AI
assistant.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Chatwoot** | `chatwoot/chatwoot:v4.18.0` | Public. Web server and Sidekiq (background jobs) in one service. Migrations run on boot. Uploads on a 5 GB volume |
| **db** | PostgreSQL 16 + pgvector | Internal. Conversations, contacts, settings. Chatwoot 4 requires the `vector` extension |
| **redis** | Redis 7 | Internal. Job queue, real-time updates, caches |

## After deploy

Sign in with the **admin email and password** from the deploy form. The
template creates that admin (a super admin of the installation) on first boot,
so Chatwoot's "create your super admin" page is never open to whoever finds
your URL first. Public sign-up is off: invite your team from **Settings →
Agents**.

Then add an inbox under **Settings → Inboxes**. For website live chat, paste the
widget snippet Chatwoot gives you into your site.

## Good to know

- **Email.** Without SMTP, Chatwoot works but can't send invitations, password
  resets or email notifications. Fill in the SMTP variables (and
  `MAILER_SENDER_EMAIL`) and redeploy to turn them on.
- The password must contain an uppercase letter, a lowercase letter, a number
  and a special character. If Chatwoot rejects the admin's details, the
  service stops at boot and logs why: fix them and redeploy.
- `ADMIN_*` and `COMPANY_NAME` are only used while the installation has no
  users.
- The super-admin console lives at `/super_admin`.
- Chatwoot wants about **2 GB of memory** for the web server and Sidekiq
  together.
