// What a `preset:` service becomes on Unbroker Cloud — a copy of the platform's
// one-click datastores (apps/api/src/modules/apps/db-templates.ts) so
// `npm run try` runs them the same way. The platform's own table wins; update
// this one when it changes.
//
// Each preset runs as uid 999 with its volume at the engine's data dir, under
// the platform's default limits for its resource profile (paas.ts
// configuredRuntimeResources: 384 MiB / 250m for databases, 128 MiB / 100m
// for Redis), and
// exposes these env vars for siblings to read through
// ${{services.<name>.env.KEY}} — POSTGRES_PASSWORD, REDIS_PASSWORD,
// MONGO_INITDB_ROOT_PASSWORD, MYSQL_ROOT_PASSWORD.
export const PRESETS = {
  postgres: (pw) => ({
    image: "postgres:16",
    port: 5432,
    volumePath: "/var/lib/postgresql/data",
    startCommand:
      "exec docker-entrypoint.sh postgres -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=top",
    env: { POSTGRES_PASSWORD: pw, PGDATA: "/var/lib/postgresql/data/pgdata" },
    memoryMiB: 384,
    cpuMillicores: 250,
  }),
  redis: (pw) => ({
    image: "redis:7",
    port: 6379,
    volumePath: "/data",
    startCommand: 'redis-server --requirepass "$REDIS_PASSWORD" --appendonly yes --appendfsync always',
    env: { REDIS_PASSWORD: pw },
    memoryMiB: 128,
    cpuMillicores: 100,
  }),
  mongodb: (pw) => ({
    image: "mongo:7",
    port: 27017,
    volumePath: "/data/db",
    env: { MONGO_INITDB_ROOT_USERNAME: "root", MONGO_INITDB_ROOT_PASSWORD: pw },
    memoryMiB: 384,
    cpuMillicores: 250,
  }),
  mysql: (pw) => ({
    image: "mysql:8",
    port: 3306,
    volumePath: "/var/lib/mysql",
    // MySQL 8.4's defaults (performance_schema, a 128M buffer pool, a 64M log
    // buffer) need more than the 384 MiB limit and were OOM-killed while
    // InnoDB initialised; these keep it well inside.
    startCommand:
      "exec docker-entrypoint.sh mysqld --performance-schema=OFF --innodb-buffer-pool-size=64M --innodb-log-buffer-size=8M --key-buffer-size=8M --temptable-max-ram=32M --max-connections=100",
    env: { MYSQL_ROOT_PASSWORD: pw, MYSQL_DATABASE: "app" },
    memoryMiB: 384,
    cpuMillicores: 250,
  }),
};
