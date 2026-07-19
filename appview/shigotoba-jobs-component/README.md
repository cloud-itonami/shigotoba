# shigotoba-jobs-component

Global jobs marketplace component for `shigotoba.etzhayyim.com`.

## Endpoints

- `GET /`
- `POST /api/mcp`
- `GET|POST /api/v1/jobs/search`
- `POST|GET /api/v1/jobs/refresh`
- `GET /api/v1/jobs/{jobId}`
- `GET /api/v1/companies`
- `POST|GET /api/v1/applications`
- `GET /api/v1/market/summary`
- `GET /api/v1/data/sources`
- `GET /healthz`

## MCP tools

- `shigotoba.search_jobs`
- `shigotoba.get_job`
- `shigotoba.create_application`
- `shigotoba.market_summary`
- `shigotoba.data_sources`
- `shigotoba.refresh_public_jobs`

## Notes

- Job catalog is sourced from public APIs (`remotive`, `arbeitnow`, `remoteok`) and refreshed on interval.
- Application store remains in-memory for now.
- Source design and normalization policy: `DATA_SOURCES.md`
- UI is built from `svelte/` and uses `@etzhayyim/appshellv2` components (`AppShell`, `Header`, `Sidebar`, `ThemeToggle`, `AppsDirectory`).
- Built static assets are emitted to `static/` and served by the Go component.

## UI Build

- `cd svelte`
- `npm install`
- `npm run build`
- This regenerates `static/index.html` and `static/assets/*`.

## Refresh Config

- `SHIGOTOBA_PUBLIC_DATA_ENABLED` (default: `true`)
- `SHIGOTOBA_JOB_REFRESH_SECONDS` (default: `900`)
- `SHIGOTOBA_SOURCE_TIMEOUT_SECONDS` (default: `20`)
- `SHIGOTOBA_SOURCE_MAX_JOBS` (default: `1500`)
