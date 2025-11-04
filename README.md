# Vessel App

## Backend Environment

The Express backend expects the following variables at runtime (configure them in Render/Elestio or a local `.env` file):

- `DATABASE_URL` – full Postgres connection string from Elestio, e.g. `postgres://user:pass@host:5432/db`
- `PGSSLMODE` – optional; set to `disable` to skip TLS. Leave unset/`require` when Elestio needs SSL.
- `REDIS_URL` – Redis connection string, e.g. `redis://:password@host:6379/0`

Run `npm install` inside `vessel-app/backend` to pull the new `pg`, `ioredis`, and `dotenv` dependencies before starting the server.

