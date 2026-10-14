# Directus

Turns a SQL database into an instant REST and GraphQL API, with a no-code app
to manage content, users, files and permissions.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Directus** | `directus/directus:12.5.0` | Public. Admin app at `/admin`. 1 GiB volume for uploaded files |
| **db** | PostgreSQL 16 | Internal. Your data model and content |

## After deploy

Open `<your-url>/admin` and sign in with the **admin email and password** from
the deploy form.

## Notes

Directus uses the Business Source License: it is free for organizations under
USD 5M in annual revenue. Check [their license](https://directus.io/bsl) for
anything beyond that.
