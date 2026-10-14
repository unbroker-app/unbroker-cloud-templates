# Ghost

A professional publishing platform: a modern editor, newsletters, paid
memberships and themes.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Ghost** | `ghost:6.70.0` | Public. 1 GiB volume for themes, images and uploads |
| **db** | MySQL 8 | Internal. Posts, members and settings |

## After deploy

Go to `<your-url>/ghost` and create the **owner account**. The first visitor to
that page gets it, so do this right away.

## Notes

- **Email.** Staff invites, password resets and newsletters need an SMTP or
  Mailgun account. Ghost reads its config from lowercase variables, so add yours
  to the `export …` line of the service's start command, e.g.
  `mail__transport=SMTP mail__options__host=…`.
- **Custom domain.** Ghost builds every link from its `url`. After you add a
  domain, set `GHOST_URL` to it and redeploy.
