# Shigotoba Public Data Source Design

## Objective

`shigotoba.etzhayyim.com` の求人データを固定 seed ではなく、認証不要の公開 API から継続取得して反映する。

## Sources (current)

1. `remotive`
- Endpoint: `https://remotive.com/api/remote-jobs`
- Strength: リモート職種の国際求人が多い
- Key fields: `id`, `title`, `company_name`, `job_type`, `candidate_required_location`, `publication_date`, `salary`, `tags`, `url`

2. `arbeitnow`
- Endpoint: `https://www.arbeitnow.com/api/job-board-api?page=1`
- Strength: 欧州(特にドイツ)の実求人が豊富
- Key fields: `slug`, `title`, `company_name`, `location`, `job_types`, `created_at`, `remote`, `tags`, `url`

3. `remoteok`
- Endpoint: `https://remoteok.com/api`
- Strength: グローバル remote 求人の更新頻度が高い
- Key fields: `id`, `position`, `company`, `location`, `tags`, `date`, `salary_min`, `salary_max`, `url`

## Refresh Strategy

- In-memory catalog を持ち、起動時に初回取得。
- 以後 `SHIGOTOBA_JOB_REFRESH_SECONDS` (default: `900` sec) で定期更新。
- 読み取り時に stale 判定し、必要ならバックグラウンド再取得。
- 全ソース失敗時は前回成功データを保持 (fail-open cache)。

## Normalization Policy

- Canonical schema: `jobPosting` / `companyProfile`。
- Stable job id: `job-<fnv64(source|source_id|title|company)>`
- Stable company id: `cmp-<fnv64(company_name)>`
- Location: `country/city` へヒューリスティック分解。
- Employment type: `full-time | part-time | contract | internship | temporary` に正規化。
- Remote type: `remote | hybrid | onsite` に正規化。
- Salary:
  - 数値抽出 + period 推定 (`hour/day/week/month/year`)
  - USD 年額へ換算して `min_salary_usd/max_salary_usd` へ格納
- `source`, `source_job_id`, `source_url`, `fetched_at` を保持しトレーサビリティを担保。

## Runtime Observability

- `GET /api/v1/data/sources`
  - source ごとの最終成功時刻/最終エラー/取得件数/採用件数を返却
- `POST /api/v1/jobs/refresh`
  - 即時再取得をトリガー
- `GET /healthz`
  - catalog freshness を返却

## Config Knobs

- `SHIGOTOBA_PUBLIC_DATA_ENABLED` (default: `true`)
- `SHIGOTOBA_JOB_REFRESH_SECONDS` (default: `900`)
- `SHIGOTOBA_SOURCE_TIMEOUT_SECONDS` (default: `20`)
- `SHIGOTOBA_SOURCE_MAX_JOBS` (default: `1500`)

## Known Constraints

- 外部ソース依存のため、API 停止時は更新遅延が発生。
- ソース間で給与・勤務地の粒度が異なるため、一部推定値を含む。
- 現時点は in-memory cache のみ。永続化は次段階で `performer/rdbms` (cypher graph RDBMS) へ拡張予定。
