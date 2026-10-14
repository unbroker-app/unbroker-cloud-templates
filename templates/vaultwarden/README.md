# Vaultwarden

A lightweight server that speaks the Bitwarden API, so the official Bitwarden
apps, browser extensions and CLI work against it.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Vaultwarden** | `vaultwarden/server:1.37.4` | Public. 1 GiB volume for the vault database (SQLite), attachments and keys |

## After deploy

1. Open the URL and **create your account**.
2. Turn off public signups: set `SIGNUPS_ALLOWED` to `false` in the service's
   variables and redeploy.
3. In any Bitwarden app, pick **Self-hosted** and enter the service URL as the
   server.

The admin panel lives at `/admin`, behind the `ADMIN_TOKEN` you chose at
deploy. Service variables are write-only, so keep a copy: to change it, set a
new `ADMIN_TOKEN` and redeploy. Deleting the variable turns the panel off.

## Notes

Vaultwarden is an independent project, not affiliated with Bitwarden, Inc.
Back up the volume: it is your vault.
