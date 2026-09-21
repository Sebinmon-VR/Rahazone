# Rahazone

Property portfolio and shareholder portal. An administrator records projects (buildings), the rentable
units inside them (shops, rooms, offices), tenancy contracts, documents and every income/expense entry.
Shareholders log in to see only the projects they hold shares in, with profit and loss scaled to their
percentage, and can post feedback on any project or unit.

## Stack

- **Backend** `server/` – Node 22+/24, Express 5, **Azure SQL / SQL Server** via the `mssql` driver, JWT auth, multer uploads.
- **Frontend** `client/` – React 19, TypeScript, Vite, Tailwind CSS v4, React Router, lucide icons.

## Quick start

```bash
npm run setup                     # installs server and client dependencies
cp server/.env.example server/.env   # then fill in the database settings (see below)
npm run seed                      # optional demo data (2 projects, 8 units, contracts, 7 months of P&L)
npm run dev:server                # API on http://localhost:4000
npm run dev:client                # UI on http://localhost:5173 (proxies /api to the server)
```

Default logins (created on first run / by the seed):

| Role        | Email                | Password |
|-------------|----------------------|----------|
| Admin       | admin@rahazone.com   | admin123 |
| Shareholder | ahmed@example.com    | user123  |
| Shareholder | sara@example.com     | user123  |

Change the admin password from **Settings** after first login. Override the bootstrap admin with
`ADMIN_EMAIL` / `ADMIN_PASSWORD`, and always set `JWT_SECRET` in production.

## Environment variables (`server/.env`)

No `.env` file of any kind is committed; git ignores `.env`, `.env.*` and the template. Create `server/.env`
by hand from this table.

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `DATABASE_URL` | one of | Full SQL Server connection string (ADO or `mssql://` style) |
| `DB_SERVER`, `DB_NAME` | one of | Server host and database name when not using `DATABASE_URL` |
| `DB_USER`, `DB_PASSWORD` | with `DB_SERVER` | SQL authentication |
| `DB_AUTH=aad` | with `DB_SERVER` | Azure AD auth instead of a password (`az login` locally, Managed Identity in Azure) |
| `JWT_SECRET` | yes in prod | Long random string used to sign login tokens |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no | First-run admin account (defaults: admin@rahazone.com / admin123) |
| `PORT` | no | API port, default 4000 |
| `AZURE_STORAGE_CONNECTION_STRING` | no | Enables Azure Blob Storage for documents; otherwise local disk |
| `AZURE_STORAGE_CONTAINER` | no | Container name, default `uploads` (created if missing) |
| `AZURE_STORAGE_PREFIX` | no | Folder inside the container, default `rahazone` |
| `MAX_UPLOAD_BYTES` | no | Per-file upload limit, default 25 MB |
| `UPLOAD_DIR` | no | Local folder for documents when Blob is not configured |

## Database configuration

The server creates its tables on first start if they do not exist. All app tables are prefixed `rz_`
(`rz_users`, `rz_projects`, `rz_project_shares`, `rz_items`, `rz_contracts`, `rz_transactions`,
`rz_documents`, `rz_feedback`) so they can live alongside other tables in a shared database.

Pick one of:

```ini
# A. One connection string (copy from the Azure portal → database → Connection strings → ADO.NET)
DATABASE_URL=Server=tcp:HOST.database.windows.net,1433;Initial Catalog=DB;User ID=USER;Password=PASS;Encrypt=true

# B. Discrete settings, SQL authentication
DB_SERVER=HOST.database.windows.net
DB_NAME=DB
DB_USER=USER
DB_PASSWORD=PASS

# C. Discrete settings, Azure AD (uses `az login` locally, Managed Identity when hosted on Azure)
DB_SERVER=HOST.database.windows.net
DB_NAME=DB
DB_AUTH=aad
```

A serverless Azure SQL database can take up to a minute to resume from pause; the server retries the
connection automatically during start-up.

## Document storage

Uploaded contracts and other documents go to **Azure Blob Storage** when a connection string is set:

```ini
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=uploads      # created automatically if missing
AZURE_STORAGE_PREFIX=rahazone        # virtual folder inside the container
MAX_UPLOAD_BYTES=8388608             # per-file limit (default 25 MB)
```

Files are stored as `<container>/<prefix>/<random-name>.<ext>`; the original name, type, size and
owning project / unit / contract live in the `rz_documents` table. Downloads are streamed through the
API after the access check, so the container can stay private.

Without a connection string, files are written to `server/uploads` (override with `UPLOAD_DIR`), which
is fine for a single VPS but not for Azure App Service.

## Production

```bash
npm run build          # builds client/dist
npm start              # server serves the API and the built UI on port 4000
```

## Roles

| Capability                                   | Admin | Shareholder |
|----------------------------------------------|:-----:|:-----------:|
| Create / edit projects, units, contracts     |  ✓    |             |
| Record income and expenses                   |  ✓    |             |
| Upload / delete documents                    |  ✓    |             |
| Assign share percentages to users            |  ✓    |             |
| Manage users                                 |  ✓    |             |
| View projects, units, contracts, documents   |  all  | own projects only |
| View P&L                                     |  full | scaled to own share |
| Post feedback on a project or unit           |  ✓    |  ✓          |
| Reply to feedback                            |  ✓    |             |

## API overview

All routes are under `/api` and, except login, require `Authorization: Bearer <token>`.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | returns `{ token, user }` |
| GET | `/auth/me` · POST `/auth/change-password` | |
| GET/POST | `/users` · PUT/DELETE `/users/:id` | admin |
| GET | `/projects` · `/projects/portfolio` | scoped to caller |
| GET/PUT/DELETE | `/projects/:id` | detail includes units, shareholders, docs, P&L |
| PUT | `/projects/:id/shares` · DELETE `/projects/:id/shares/:userId` | admin; total ≤ 100 % |
| GET/POST | `/projects/:id/transactions` · PUT/DELETE `.../:txId` | |
| POST | `/items` · GET/PUT/DELETE `/items/:id` | detail includes contracts + their docs |
| GET/POST | `/contracts` · PUT/DELETE `/contracts/:id` | admin; one active contract per unit |
| POST | `/documents` (multipart: `file`, `title`, `category`, one of `project_id`/`item_id`/`contract_id`) | admin |
| GET | `/documents/:id/download?inline=1` | |
| GET/POST | `/feedback` · POST `/feedback/:id/reply` · DELETE `/feedback/:id` | |

P&L: `net = Σ income − Σ expense` per project; a shareholder's figures are `net × share % / 100`.

Deleting a project, unit or contract removes its transactions, documents (including files on disk) and
feedback inside one database transaction; see `server/src/cascade.js`.
