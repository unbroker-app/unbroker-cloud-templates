# Metabase

Open-source business intelligence: connect your databases, ask questions with
a visual query builder or SQL, and share dashboards with your team.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Metabase** | `metabase/metabase:v0.64.2.3` | Public. Database drivers on a 1 GB volume |
| **db** | PostgreSQL 16 | Internal. Metabase's own data: users, questions, dashboards |

## After deploy

Metabase takes a minute or two to start the first time. Then sign in with the
**admin email and password** you entered in the deploy form: the template
completes Metabase's setup with them on first boot, so the "create the first
admin" page is never open to whoever finds your URL first.

Add the databases you want to analyze under **Admin → Databases → Add a
database**. A sample database is included to play with.

## Good to know

- The password must have at least **15 characters** and not be a common
  one. If Metabase rejects it, the container stops and logs why: redeploy with a
  better password.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are only used on first boot. Change them
  later in Metabase under **Account settings**.
- `MB_ENCRYPTION_SECRET_KEY` is generated at deploy and encrypts the
  credentials of the databases you connect. Don't change it.
- Metabase is a Java app and wants about **1 GB of memory** or more.
