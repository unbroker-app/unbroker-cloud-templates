# MailCheap

A newsletter app where you pay your email provider for the emails you send,
not a platform for every subscriber on your list. Write an issue, send it to
your list and publish it on the web, from the dashboard or from an AI agent
through its MCP server and REST API. Imports beehiiv, Substack, Mailchimp, Kit
and other CSV exports as they are.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **MailCheap** | `ghcr.io/unbroker-app/mailcheap-container` | Public. The upstream app, built from a pinned commit by [mailcheap-container](https://github.com/unbroker-app/mailcheap-container) |
| **db** | MongoDB 7 | Internal. Accounts, contacts, campaigns and stats |

The session secret and the key of the never-email list are generated for you.
Don't change them later: the first signs everyone out and breaks the links in
emails already sent, the second empties the list.

## Before you deploy

MailCheap signs you in with a code it emails, so it needs a way to send email
from the first minute. Pick one:

- **Resend** (quickest): verify the domain of `EMAIL_FROM` at
  [Resend](https://resend.com) and fill in `RESEND_API_KEY`.
- **Amazon SES**: fill in the `SES_*` fields and verify the domain of
  `EMAIL_FROM` in that AWS account (Identities, Easy DKIM).

Without either, the app runs but nobody can sign in.

## After deploy

1. Open the app's URL and sign in with `ADMIN_EMAIL`. Only that address and the
   ones in `ALLOWED_EMAILS` can sign in.
2. To send to readers, follow upstream's
   [self-hosting guide](https://github.com/marclou/mailcheap#self-hosting),
   steps 4 to 6, with your app's URL in place of the Vercel one:
   - **Amazon SES**: production access, an SNS topic subscribed to
     `https://<your-app>/api/webhooks/ses`, and an IAM user with the policy the
     guide lists. Fill in the `SES_*` variables.
   - **Upstash QStash**: fill in `QSTASH_TOKEN` and the two signing keys. QStash
     calls your app back over the internet to send each batch.
   - Add your sending domain under **Domains**, create a newsletter, then set
     `SENDING_ENABLED` to `true`.

Until `SENDING_ENABLED` is `true`, nothing reaches readers. Sign-in codes and
alerts go out either way.

## Caveats

- **Amazon SES only.** The template sets `EMAIL_PROVIDER=ses`. For PostShiba
  (invite only), change it to `postshiba` and add the `POSTSHIBA_*` variables
  from upstream's [`.env.example`](https://github.com/marclou/mailcheap/blob/main/.env.example).
- **Image uploads are off** until you add an S3 bucket behind CloudFront
  (`IMAGES_S3_*`, `IMAGES_CDN_URL`) or a Vercel Blob token. Campaigns can still
  use images hosted anywhere.
- **Rate limits are per container.** Upstash Redis (`UPSTASH_REDIS_REST_*`)
  shares them, but it only matters with more than one instance.
- **Built-in pages show a placeholder URL.** The docs pages, `robots.txt`,
  `sitemap.xml` and `llms.txt` are rendered when the image is built, before
  your URL exists, so they show `http://localhost:3000`. Email links, sign-in,
  the API and MCP use your real URL.
- Google sign-in, Telegram alerts and the other optional settings in upstream's
  `.env.example` can be added as variables on the service.
