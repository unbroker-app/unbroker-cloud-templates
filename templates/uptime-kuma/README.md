# Uptime Kuma

A friendly self-hosted monitoring tool. It checks HTTP(s), TCP, ping, DNS,
Docker and more, can publish public status pages, and sends alerts to 90+
notification services.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Uptime Kuma** | `louislam/uptime-kuma:2.5.6` | Public. 1 GiB volume for its database and settings |

## After deploy

1. Open the URL. On first launch Uptime Kuma asks which database to use: pick
   **SQLite**. It lives on the service's volume.
2. Create the admin account. The first visitor gets it, so do this right away.
3. Add monitors, then share a status page if you want one.

## Notes

Uptime Kuma checks from inside the platform, so keep the service running for
your monitors to keep firing.
