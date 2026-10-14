# Miniflux

A minimalist, fast feed reader: RSS, Atom and JSON Feed, keyboard shortcuts,
full-text fetching, and a REST API, with no tracking and no clutter.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Miniflux** | `miniflux/miniflux:2.3.3` | Public. Migrations run on boot |
| **db** | PostgreSQL 16 | Internal. Feeds, entries and users |

## After deploy

Sign in with the **admin username and password** you entered in the deploy
form. Add more users under **Settings → Users**.

To use a mobile or desktop client (Fever or Google Reader API), enable it under
**Settings → Integrations**.
