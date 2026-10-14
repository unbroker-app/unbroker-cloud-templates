# ClickHouse

The open-source column-oriented database for real-time analytics: SQL over
billions of rows in milliseconds, with compression that keeps the disk small.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **ClickHouse** | `clickhouse/clickhouse-server:26.8.27.9` (LTS) | Public HTTP interface. Data on a 10 GB volume |

## After deploy

Your URL serves ClickHouse's **HTTP interface** over HTTPS. Sign in as
`default` with the password from the deploy form:

- **In the browser**: open `https://<your-url>/play` for the built-in SQL
  console.
- **From code**: any HTTP client, e.g. Python's `clickhouse-connect`:
  ```python
  import clickhouse_connect
  client = clickhouse_connect.get_client(host="<your-url>", port=443, secure=True,
                                         username="default", password="…")
  ```
- **curl**:
  ```bash
  curl -u default:… https://<your-url>/ --data-binary "SELECT version()"
  ```

`default` can manage access: create a user per app with `CREATE USER … IDENTIFIED BY …`
and `GRANT`.

## Good to know

- Only the HTTP interface is exposed. The native TCP protocol (port 9000,
  used by `clickhouse-client`) is not reachable from outside. Use
  `clickhouse-client` from inside the project, or an HTTP client.
- Changing `CLICKHOUSE_PASSWORD` and redeploying changes the `default` user's
  password.
- ClickHouse uses up to 90% of the memory it is given. 2 GB or more is
  comfortable for real workloads.
