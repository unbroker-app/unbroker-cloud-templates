# Umami

Simple, fast, privacy-focused web analytics: pageviews, referrers, devices,
events, funnels and goals, with no cookies and nothing sent to third parties.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Umami** | `ghcr.io/umami-software/umami:3.4.0` | Public. Migrations run on boot |
| **db** | PostgreSQL 16 | Internal. Websites, users and every event |

## After deploy

Sign in with username **`admin`** and the **password you entered in the deploy
form**. Umami ships with `admin` / `umami`; the template replaces that password
as soon as the server is up, so the default never works on your instance.

Then add a website under **Settings → Websites → Add website** and paste its
tracking code into your site's `<head>`:

```html
<script defer src="https://<your-umami-url>/script.js" data-website-id="…"></script>
```

## Good to know

- `ADMIN_PASSWORD` is only applied while the account still has the default
  password. Changing it later in the deploy form does nothing: change it in
  Umami under **Profile → Change password**.
- Ad blockers often block `script.js`. Umami's docs explain how to
  [rename the tracker](https://umami.is/docs/environment-variables) with
  `TRACKER_SCRIPT_NAME` if that matters to you.
