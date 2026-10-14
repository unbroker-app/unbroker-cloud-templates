# Unbroker Cloud templates

One-click apps for [Unbroker Cloud](https://unbroker.cloud). Every folder in
[`templates/`](templates) is a template: a small YAML file that describes the
services an app needs, how they connect, and what the user is asked when they
deploy it. Templates on `main` appear in the **Deploy a Template** gallery a few
minutes after merge.

**Contributions are welcome.** Adding a template takes one pull request. See
[Adding a template](#adding-a-template).

## Layout

```
templates/<slug>/
  template.yaml   # the manifest. The folder name is the template's slug
  README.md       # the detail page shown in the gallery
  logo.svg        # optional, or logo.png: a square mark, max 64 KB
scripts/
  schema.mjs      # the rules (mirrors what the platform enforces)
  build.mjs       # validate everything and build dist/catalog.json
  try.mjs         # run a template locally under the platform's constraints
  e2e.mjs         # try + drive + restart + check: what CI runs on every PR
  e2e/<slug>.mjs  # optional per-template end-to-end steps
```

## template.yaml

```yaml
name: Miniflux
tagline: Minimalist, opinionated feed reader       # max 120 chars
category: productivity   # ai | automation | analytics | backend | cms | database
                         # | devtools | monitoring | productivity | storage | other
tags: [rss, reader]
maintainer: Your Name
links:
  website: https://miniflux.app
  source: https://github.com/miniflux/v2

# Asked in the deploy form. required defaults to true; a default pre-fills it.
variables:
  ADMIN_PASSWORD:
    description: Password for the first admin account.

services:
  db:
    preset: postgres          # postgres | redis | mongodb | mysql (managed by us)
    env:
      POSTGRES_DB: miniflux

  miniflux:
    name: Miniflux
    image: miniflux/miniflux:2.3.3   # always pin a version
    port: 8080
    cpuLimit: 500             # optional per-replica limit in millicores (100–2000)
    memoryLimit: 512          # optional per-replica limit in MiB (128–6144)
    public: true              # gets a public HTTPS URL
    healthcheck: /healthcheck # must answer 2xx/3xx once the app is ready
    volume:                   # optional persistent disk
      path: /data
      sizeGb: 1
    startCommand: ...         # optional, runs through /bin/sh -c
    env:
      DATABASE_URL: postgres://postgres:${{services.db.env.POSTGRES_PASSWORD}}@${{services.db.host}}:${{services.db.port}}/miniflux?sslmode=disable
      ADMIN_PASSWORD: ${{vars.ADMIN_PASSWORD}}
      SESSION_SECRET: ${{secret(48)}}
      BASE_URL: ${{services.miniflux.url}}
```

### Tokens in `env` values

| Token | Becomes |
|---|---|
| `${{services.<name>.host}}` / `.port` | That service's private address inside the project |
| `${{services.<name>.url}}` | Its public HTTPS URL (a service may use its own) |
| `${{services.<name>.env.KEY}}` | Another service's variable, e.g. a preset's `POSTGRES_PASSWORD` |
| `${{secret}}` / `${{secret(N)}}` | A random alphanumeric secret, 32 or N (8 to 128) characters, minted once per deploy |
| `${{vars.KEY}}` | The user's answer from the deploy form |

References stay live: they are resolved on every deploy, so if a password
changes, the services that reference it pick up the new value.

### Presets

`preset:` services run our managed datastore images and expose their
credentials for other services to reference:

| Preset | Image | Port | Credential variable | User |
|---|---|---|---|---|
| `postgres` | `postgres:16` | 5432 | `POSTGRES_PASSWORD` | `postgres` |
| `mysql` | `mysql:8` | 3306 | `MYSQL_ROOT_PASSWORD` | `root` |
| `redis` | `redis:7` | 6379 | `REDIS_PASSWORD` | |
| `mongodb` | `mongo:7` | 27017 | `MONGO_INITDB_ROOT_PASSWORD` | `root` |

Set `POSTGRES_DB` / `MYSQL_DATABASE` in the preset's `env` to create your
app's database on first boot.

## The runtime your image must tolerate

Unbroker Cloud runs every container hardened, and most "it crashes on boot"
problems come from this:

- **A non-root user, uid/gid 10001**, whatever `USER` the image declares, with
  all Linux capabilities dropped. That user has **no `/etc/passwd` entry**: set
  `SHELL=/bin/sh` for CLIs that look up the current user's shell.
- **Only the volume is writable.** The image's own directories belong to
  another user. Point the app's data directory at the volume.
- **`HOME=/tmp`** (a small scratch dir), pinned by the platform.
- **`PORT` and `HOST=0.0.0.0` are injected.** The app must listen on `port`,
  on all interfaces, above 1024.
- **Variable names are `UPPER_SNAKE_CASE`.** If an app reads lowercase
  config, map it in `startCommand` (see [`ghost`](templates/ghost/template.yaml)).
- **Containers restart on failure**, and datastores deploy before the apps
  that reference them, so an app may briefly start before its database
  accepts connections.

## Adding a template

1. Copy the closest existing template into `templates/<slug>/`.
2. Pin the image to a version, and keep the manifest minimal: only the variables
   the app needs to boot securely.
3. Validate it, then run it the way the platform would:
   ```bash
   npm install
   npm run validate
   npm run try -- <slug> --set KEY=value     # needs Docker
   npm run try -- <slug> --down
   ```
   `try` drops privileges, pins `HOME`, mounts the volume like a cluster disk,
   resolves every token, and waits for each public service's healthcheck.
4. Make sure it works past the healthcheck: sign in, create something, restart
   the container, and confirm the data is still there. Write that down as
   `scripts/e2e/<slug>.mjs` (see [`miniflux`](scripts/e2e/miniflux.mjs)) so CI
   checks it on every change:
   ```bash
   npm run e2e -- <slug>          # boot, setup, verify, restart, verify again
   ```
   Without an e2e file, CI still boots the template, restarts every container
   and waits for the healthchecks again.
5. Write the `README.md`: what gets deployed, what to do right after deploy
   (who gets the first account?), and any caveats.
6. Open a pull request. CI runs the same validation, and `npm run e2e` for
   every template the pull request touches.

Templates marked `official: true` are maintained by the Unbroker team. Leave it
out for community templates.

## Publishing

On every push to `main`, CI builds `dist/catalog.json` and publishes it to the
`catalog` branch. Logo URLs are pinned to that commit on jsDelivr. Unbroker
Cloud reads the catalog, re-validates each entry, and caches it for 5 minutes.

## License

[MIT](LICENSE). Logos and product names belong to their respective owners.
