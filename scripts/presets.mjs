// What a `preset:` service becomes on Unbroker Cloud — a copy of the platform's
// one-click datastores (apps/api/src/modules/apps/db-templates.ts) so
// `npm run try` runs them the same way. The platform's own table wins; update
// this one when it changes.
//
// Each preset runs as uid 999 with its volume at the engine's data dir and
// exposes these env vars for siblings to read through
// ${{services.<name>.env.KEY}} — POSTGRES_PASSWORD, REDIS_PASSWORD,
// MONGO_INITDB_ROOT_PASSWORD, MYSQL_ROOT_PASSWORD.
export const PRESETS = {
  postgres: (pw) => ({
    // postgres:16 plus the pgvector extension (unbroker-app/unbroker-cloud#677).
    image: "pgvector/pgvector:pg16",
    port: 5432,
    volumePath: "/var/lib/postgresql/data",
    startCommand:
      "exec docker-entrypoint.sh postgres -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=top",
    env: { POSTGRES_PASSWORD: pw, PGDATA: "/var/lib/postgresql/data/pgdata" },
  }),
  redis: (pw) => ({
    image: "redis:7",
    port: 6379,
    volumePath: "/data",
    startCommand: 'redis-server --requirepass "$REDIS_PASSWORD" --appendonly yes --appendfsync always',
    env: { REDIS_PASSWORD: pw },
  }),
  mongodb: (pw) => ({
    image: "mongo:7",
    port: 27017,
    volumePath: "/data/db",
    env: { MONGO_INITDB_ROOT_USERNAME: "root", MONGO_INITDB_ROOT_PASSWORD: pw },
  }),
  mysql: (pw) => ({
    image: "mysql:8",
    port: 3306,
    volumePath: "/var/lib/mysql",
    env: { MYSQL_ROOT_PASSWORD: pw, MYSQL_DATABASE: "app" },
  }),
};
