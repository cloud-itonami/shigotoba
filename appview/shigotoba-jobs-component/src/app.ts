import {
  asAgentTool,
  createWorkerExport,
  nowISO,
  str,
  withCapabilityTags,
  withOCELEvent,
  type ComAtprotoSyncSubscribeReposCommit,
  type HostSDK, resolveHeartbeatCadence, createCadenceState, createInboxBuffer, decodeJson, createKyselyDb,
  nsid,
  parseLexiconInput,
  sql,
} from "@etzhayyim/kotodama-host-sdk";

const cadenceState = createCadenceState();
const inbox = createInboxBuffer();

let appId = ""
let actorDID = ""

type JsonRow = Record<string, unknown>;
type KyselyDb = ReturnType<typeof createKyselyDb>;

const SHIGOTOBA_ACTOR_ID = "a80c21a0";
const SHIGOTOBA_JOB_TABLE = "vertex_shigotoba_job_posting";
const SHIGOTOBA_COMPANY_TABLE = "vertex_shigotoba_company_profile";

function getDb(): KyselyDb {
  return createKyselyDb();
}

function normalizeJobPostingRow(row: Record<string, unknown>): JsonRow {
  return {
    id: str(row.id),
    title: str(row.title),
    companyName: str(row.company_name),
    companyId: str(row.company_id),
    location: str(row.location),
    country: str(row.country),
    city: str(row.city),
    employmentType: str(row.employment_type),
    remoteType: str(row.remote_type),
    minSalaryUsd: Number(row.min_salary_usd ?? 0),
    maxSalaryUsd: Number(row.max_salary_usd ?? 0),
    tags: decodeJson(str(row.tags_json), [] as string[]),
    sourceUrl: str(row.source_url),
    source: str(row.source),
    sourceJobId: str(row.source_job_id),
    description: str(row.description),
    fetchedAt: str(row.fetched_at),
    createdAt: str(row.created_at),
    orgId: str(row.org_id),
    userId: str(row.user_id),
    actorId: str(row.actor_id),
  };
}

function normalizeCompanyProfileRow(row: Record<string, unknown>): JsonRow {
  return {
    id: str(row.id),
    name: str(row.name),
    source: str(row.source),
    createdAt: str(row.created_at),
    orgId: str(row.org_id),
    userId: str(row.user_id),
    actorId: str(row.actor_id),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function listRows(label: string, limit: number, offset = 0, orderField = "createdAt", ascending = false): Promise<JsonRow[]> {
  if (label === "CompanyProfile") {
    let q: any = getDb()
      .selectFrom(SHIGOTOBA_COMPANY_TABLE as any)
      .selectAll()
      .where("actor_id", "=", SHIGOTOBA_ACTOR_ID);
    q = orderField === "name"
      ? q.orderBy("name", ascending ? "asc" : "desc")
      : q.orderBy("created_at", ascending ? "asc" : "desc");
    const rows = await q.limit(limit).offset(offset).execute();
    return rows.map((row: Record<string, unknown>) => normalizeCompanyProfileRow(row));
  }

  let q: any = getDb()
    .selectFrom(SHIGOTOBA_JOB_TABLE as any)
    .selectAll()
    .where("actor_id", "=", SHIGOTOBA_ACTOR_ID);
  q = orderField === "name"
    ? q.orderBy("title", ascending ? "asc" : "desc")
    : q.orderBy("created_at", ascending ? "asc" : "desc");
  const rows = await q.limit(limit).offset(offset).execute();
  return rows.map((row: Record<string, unknown>) => normalizeJobPostingRow(row));
}

async function getRowById(label: string, id: string): Promise<JsonRow | null> {
  if (label === "CompanyProfile") {
    const row = await getDb()
      .selectFrom(SHIGOTOBA_COMPANY_TABLE as any)
      .selectAll()
      .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
      .where("id", "=", id)
      .limit(1)
      .executeTakeFirst();
    return row ? normalizeCompanyProfileRow(row as Record<string, unknown>) : null;
  }
  const row = await getDb()
    .selectFrom(SHIGOTOBA_JOB_TABLE as any)
    .selectAll()
    .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
    .where("id", "=", id)
    .limit(1)
    .executeTakeFirst();
  return row ? normalizeJobPostingRow(row as Record<string, unknown>) : null;
}

// --- Entity DIDs (workplace types) ---

const ENTITY_DIDS: string[] = [
  "shigotobaOffice", "shigotobaFactory", "shigotobaRetail", "shigotobaRemote", "shigotobaCowork",
];

let entityDidsRegistered = false;

function registerEntityDids(sdk: HostSDK): void {
  if (entityDidsRegistered) return;
  for (const slug of ENTITY_DIDS) {
    const did = str(
      sdk.hostImports.comAtprotoIdentityCreate(slug, JSON.stringify({
        displayName: slug.replace(/_/g, " "),
        description: `Shigotoba entity DID: ${slug} — shigotoba.etzhayyim.com`,
      })),
    );
    if (did) {
      // ADR-0036: domain write via Hyperdrive direct — no collection field was ever set
      // in this dispatch (dead code), removed to comply with ADR-0036.
      // DID creation above via comAtprotoIdentityCreate is the effective registration.
    }
  }
  entityDidsRegistered = true;
}

// --- Commands ---

async function cmdListJobPostings(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const args = parseLexiconInput("com.etzhayyim.apps.shigotoba.listJobPostings", body);
  const limit = Math.min(Number(args.limit) || 50, 200);
  const offset = Number(args.offset) || 0;
  const rows = await listRows("JobPosting", limit, offset);
  return { items: rows, offset, limit };
}

async function cmdGetJobPosting(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const args = parseLexiconInput("com.etzhayyim.apps.shigotoba.getJobPosting", body);
  const id = str(args.id ?? "");
  if (!id) return { error: "id required" };
  return await getRowById("JobPosting", id) ?? { error: "not found" };
}

async function cmdSearchJobPostings(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const args = parseLexiconInput("com.etzhayyim.apps.shigotoba.searchJobPostings", body);
  const q = str(args.q ?? "");
  const limit = Math.min(Number(args.limit) || 20, 100);
  if (!q) return { items: [] };
  const rows = await getDb()
    .selectFrom(SHIGOTOBA_JOB_TABLE as any)
    .selectAll()
    .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
    .where(sql<boolean>`
      coalesce(title, '') ilike ${`%${escapeLike(q)}%`} escape '\\'
      or coalesce(company_name, '') ilike ${`%${escapeLike(q)}%`} escape '\\'
      or coalesce(description, '') ilike ${`%${escapeLike(q)}%`} escape '\\'
    `)
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute();
  return { items: rows.map((row: Record<string, unknown>) => normalizeJobPostingRow(row)) };
}

async function cmdListCompanies(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const args = parseLexiconInput("com.etzhayyim.apps.shigotoba.listCompanies", body);
  const limit = Math.min(Number(args.limit) || 50, 200);
  const offset = Number(args.offset) || 0;
  const rows = await listRows("CompanyProfile", limit, offset, "name", true);
  return { items: rows, offset, limit };
}

function dispatcherUrl(sdk: HostSDK): string {
  const env = ((sdk as unknown as { env?: Record<string, string> }).env) ?? {};
  return env.DISPATCHER_URL || "https://dispatcher.etzhayyim.com";
}

async function proxyStage(sdk: HostSDK, stageNsid: string, body: Uint8Array): Promise<unknown> {
  const started = Date.now();
  let payload: Record<string, unknown> = {};
  try {
    payload = body.byteLength > 0 ? JSON.parse(new TextDecoder().decode(body)) : {};
  } catch (e) {
    return { ok: false, error: `invalid JSON body: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const resp = await fetch(`${dispatcherUrl(sdk)}/xrpc/${stageNsid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return {
      ok: resp.ok,
      status: resp.status,
      stage: stageNsid,
      result: parsed,
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      stage: stageNsid,
      latencyMs: Date.now() - started,
    };
  }
}

function cmdWave(sdk: HostSDK, body: Uint8Array): unknown {
  const args = parseLexiconInput("com.etzhayyim.apps.shigotoba.wave", body);
  const msg = str(args.message ?? "Hello");
  return { ok: true, agent: "Shigotoba Jobs", nanoid: appId };
}

// --- Reactive Pipeline (Layer 1: ComAtprotoSyncSubscribeRepos) ---

/**
 * Handle inbound AT commits reactively.
 * - Ingest normalization now runs in shigotoba-jobs-actor via LangServer.
 * - jobPosting/companyProfile: domain record accepted (already persisted).
 * - Engagement: noted for Layer 3.
 */
function handleComAtprotoSyncSubscribeReposCommit(sdk: HostSDK, commit: ComAtprotoSyncSubscribeReposCommit): { ok: true; detail: string } {
  if (commit.action !== "create") return { ok: true, detail: "skip non-create" };

  const collection = str(commit.collection ?? "");
  const record = commit.record as Record<string, unknown> | undefined;

  if (collection === "com.etzhayyim.apps.shigotoba.collectionJob" && record) return { ok: true, detail: "collectionJob accepted" };

  if (collection === "com.etzhayyim.apps.shigotoba.jobPosting") {
    return { ok: true, detail: "jobPosting persisted" };
  }

  if (collection === "com.etzhayyim.apps.shigotoba.companyProfile") {
    return { ok: true, detail: "companyProfile persisted" };
  }

  if (collection === "app.bsky.feed.like") {
    return { ok: true, detail: "engagement noted" };
  }

  return { ok: true, detail: "commit accepted" };
}

// --- SDK + App Setup ---

// Layer 3: Shinka (Social Evolution)
const shinkaEnabled = true;

export async function runHeartbeat(sdk: HostSDK): Promise<{ ok: boolean; actions: Array<Record<string, unknown>> }> {
  const actions: Array<Record<string, unknown>> = [];
  const ts = nowISO();
  const cadence = await resolveHeartbeatCadence("did:web:a80c21a0.etzhayyim.com", cadenceState, inbox);
  actions.push({ action: "cadenceResolved", mood: cadence.mood, reason: cadence.reason, ts });

  if (actions.length === 1) actions.push({ action: "noop", mood: cadence.mood, ts });
  return { ok: true, actions };
}

async function cmdStatsShigotoba(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const [jobCountRow, companyCountRow] = await Promise.all([
    getDb()
      .selectFrom("mv_vertex_shigotoba_job_posting_count" as any)
      .select(sql<number>`coalesce(sum(cnt), 0)`.as("total"))
      .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
      .executeTakeFirst(),
    getDb()
      .selectFrom("mv_vertex_shigotoba_company_profile_count" as any)
      .select(sql<number>`coalesce(sum(cnt), 0)`.as("total"))
      .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
      .executeTakeFirst(),
  ]);
  const bySourceRows = await getDb()
    .selectFrom("mv_vertex_shigotoba_job_posting_count" as any)
    .select(["source"])
    .select(sql<number>`coalesce(sum(cnt), 0)`.as("count"))
    .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
    .groupBy("source")
    .limit(10)
    .execute();
  return {
    jobs: [{ total: Number(jobCountRow?.total ?? 0) }],
    companies: [{ total: Number(companyCountRow?.total ?? 0) }],
    bySource: bySourceRows,
    agent: "Shigotoba Jobs",
  };
}

async function cmdExportShigotoba(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const args = parseLexiconInput("com.etzhayyim.apps.shigotoba.export", body);
  const fmt = str(args.format ?? "json");
  const lim = Math.min(Number(args.limit) || 100, 1000);
  const rows = await getDb()
    .selectFrom(SHIGOTOBA_JOB_TABLE as any)
    .selectAll()
    .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
    .orderBy("created_at", "desc")
    .limit(lim)
    .execute();
  return { format: fmt, data: rows.map((row: Record<string, unknown>) => normalizeJobPostingRow(row)) };
}

function cmdHealthShigotoba(sdk: HostSDK, _body: Uint8Array): unknown {
  return { status: "healthy", agent: "Shigotoba Jobs", nanoid: "a80c21a0", did: `did:web:${appId}.etzhayyim.com`, ts: nowISO() };
}

function cmdDescribeShigotoba(sdk: HostSDK, _body: Uint8Array): unknown {
  return {
    name: "Shigotoba Jobs", did: `did:web:${appId}.etzhayyim.com`, nanoid: "a80c21a0", domain: "shigotoba",
    capabilities: ["listJobPostings", "getJobPosting", "searchJobPostings", "listCompanies", "ingestJobs", "stats", "export", "describe", "summarize", "audit"],
    protocols: ["xrpc", "w-protocol", "mcp"],
    sources: ["remotive", "arbeitnow", "remoteok"],
    graphLabels: ["JobPosting", "CompanyProfile"],
  };
}

async function cmdAuditShigotoba(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const args = parseLexiconInput("com.etzhayyim.apps.shigotoba.audit", body);
  const since = str(args.since ?? "");
  const lim = Math.min(Number(args.limit) || 50, 200);
  let query: any = getDb()
    .selectFrom(SHIGOTOBA_JOB_TABLE as any)
    .selectAll()
    .where("actor_id", "=", SHIGOTOBA_ACTOR_ID);
  if (since) query = query.where("created_at", ">=", since);
  const rows = await query
    .orderBy("created_at", "desc")
    .limit(lim)
    .execute();
  const audit = rows.map((row: Record<string, unknown>) => normalizeJobPostingRow(row));
  return { audit, count: audit.length };
}

async function cmdDataSources(sdk: HostSDK, body: Uint8Array): Promise<unknown> {
  const sources = ["remotive", "arbeitnow", "remoteok"];
  const result: Record<string, unknown>[] = [];
  for (const source of sources) {
    const row = await getDb()
      .selectFrom(SHIGOTOBA_JOB_TABLE as any)
      .select(sql<number>`count(*)`.as("total"))
      .select(sql<string | null>`max(nullif(fetched_at, ''))`.as("lastFetched"))
      .where("source", "=", source)
      .where("actor_id", "=", SHIGOTOBA_ACTOR_ID)
      .executeTakeFirst();
    result.push({ source, total: Number(row?.total ?? 0), lastFetched: row?.lastFetched ?? null });
  }
  return { sources: result };
}

// --- Domain Validation ---

function validateRecord(record: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!record.id) {
    errors.push("id is required");
  }
  if (typeof record.id === "string" && record.id.length > 128) {
    errors.push("id exceeds 128 chars");
  }
  if (record.orgId && typeof record.orgId !== "string") {
    errors.push("orgId must be string");
  }
  if (record.createdAt && typeof record.createdAt === "string") {
    const ts = Date.parse(record.createdAt as string);
    if (isNaN(ts)) {
      errors.push("createdAt is not valid ISO date");
    }
  }
  return { valid: errors.length === 0, errors };
}

// --- cross-actor invoke (DID-addressed RPC) ---
export { handleComAtprotoSyncSubscribeReposCommit };

export default createWorkerExport((sdk) => {
  appId = sdk.pds.selfNanoid ?? "";
  actorDID = sdk.pds.selfRepo ?? "";
  registerEntityDids(sdk);
  sdk.app
      .command(nsid("com.etzhayyim.apps.shigotoba.listJobPostings"), (ctx, body) => cmdListJobPostings(sdk, body),
      asAgentTool("List job postings from shigotoba.etzhayyim.com"),
      withCapabilityTags('query', 'shigotoba', 'jobs'),
      withOCELEvent("governance.audit"),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.getJobPosting"), (ctx, body) => cmdGetJobPosting(sdk, body),
      asAgentTool("Get job posting by ID"),
      withCapabilityTags('query', 'shigotoba', 'jobs'),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.searchJobPostings"), (ctx, body) => cmdSearchJobPostings(sdk, body),
      asAgentTool("Search job postings by keyword"),
      withCapabilityTags('search', 'shigotoba', 'jobs'),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.listCompanies"), (ctx, body) => cmdListCompanies(sdk, body),
      asAgentTool("List companies with job postings"),
      withCapabilityTags('query', 'shigotoba', 'companies'),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.ingestJobs"), (_ctx, body) => proxyStage(sdk, "com.etzhayyim.apps.shigotoba.ingestJobs", body),
      asAgentTool("Trigger LangServer job ingestion from public APIs"),
      withCapabilityTags('pipeline', 'shigotoba', 'ingest', 'bpmn'),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.wave"), (ctx, body) => cmdWave(sdk, body),
      asAgentTool("Respond to wave greeting"),
      withCapabilityTags('social', 'greeting'),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.stats"), (ctx, body) => cmdStatsShigotoba(sdk, body),
      asAgentTool("Job posting statistics"),
      withCapabilityTags("analytics", "shigotoba"),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.export"), (ctx, body) => cmdExportShigotoba(sdk, body),
      asAgentTool("Export job posting data"),
      withCapabilityTags("export", "shigotoba"),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.health"), (ctx, body) => cmdHealthShigotoba(sdk, body),
      asAgentTool("Health check"),
      withCapabilityTags("diagnostics", "shigotoba"),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.describe"), (ctx, body) => cmdDescribeShigotoba(sdk, body),
      asAgentTool("Describe capabilities"),
      withCapabilityTags("meta", "shigotoba"),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.summarize"), (_ctx, body) => proxyStage(sdk, "com.etzhayyim.apps.shigotoba.summarize", body),
      asAgentTool("AI summary of job market data via BPMN"),
      withCapabilityTags("ai", "shigotoba", "bpmn"),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.audit"), (ctx, body) => cmdAuditShigotoba(sdk, body),
      asAgentTool("Audit log for job postings"),
      withCapabilityTags("audit", "shigotoba"),
      )
      .command(nsid("com.etzhayyim.apps.shigotoba.dataSources"), (ctx, body) => cmdDataSources(sdk, body),
      asAgentTool("Data source status and metrics"),
      withCapabilityTags("diagnostics", "shigotoba", "sources"),
      );
});
