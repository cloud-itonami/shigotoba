# etzhayyim-project-shigotoba

`etzhayyim-project-shigotoba` は `shigotoba.etzhayyim.com` 向けのグローバル求人サイト設計・実装プロジェクトです。

## Goal

- Indeed 風に「検索速度」「網羅性」「応募導線」を重視した求人体験を提供
- 国/都市/リモート/雇用形態/スキル/言語で横断検索できる
- App component で軽量運用し、MCP からも求人検索・応募を利用可能にする

## Product Design (MVP)

- Job search
  - キーワード検索
  - フィルタ: 国, リモート区分, 雇用形態, スキル, 言語, 最低年収USD
  - ソート: relevance / newest / salary_desc
- Job detail
  - 募集要項、必須スキル、給与レンジ、言語要件、応募可否
- Application
  - 候補者情報と CV URL を保存
  - 応募ステータスを追跡
- Market insights
  - 求人数、国別分布、リモート比率、人気スキル

## System Design

- Single wasm component (`shigotoba-jobs-component`)
  - Web UI (`GET /`, `@etzhayyim/appshellv2` integrated)
  - REST API (`/api/v1/*`)
  - MCP endpoint (`POST /api/mcp`)
- 求人 catalogue は公開 API (`remotive`, `arbeitnow`, `remoteok`) から定期取得して反映
- application store は現時点でインメモリ（次段階で `performer/rdbms` (cypher graph RDBMS) へ移行）
- データソース設計: `60-apps/etzhayyim-project-shigotoba/wasm/shigotoba-jobs-component/DATA_SOURCES.md`

## API (MVP)

- `GET|POST /api/v1/jobs/search`
- `POST|GET /api/v1/jobs/refresh`
- `GET /api/v1/jobs/{jobId}`
- `GET /api/v1/companies`
- `POST /api/v1/applications`
- `GET /api/v1/market/summary`
- `GET /api/v1/data/sources`
- `POST /api/mcp`

## MCP Tools (MVP)

- `shigotoba.search_jobs`
- `shigotoba.get_job`
- `shigotoba.create_application`
- `shigotoba.market_summary`
- `shigotoba.data_sources`
- `shigotoba.refresh_public_jobs`
