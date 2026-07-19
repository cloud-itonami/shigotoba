/**
 * shigotoba kotoba — companyProfile + jobPosting registries + coverage.
 * AT PDS records (no RW). Job postings FK→company. Public employer-side
 * registry + job-board open-data only; LLM summarize stays etzhayyim.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  COMPANY_COLLECTION,
  EMPLOYMENT_TYPES,
  JOB_POSTING_COLLECTION,
  SIZE_BUCKETS,
  companyDidFor,
  companyRkey,
  isCountryCode,
  isUintString,
  postingDidFor,
  postingRkey,
  type AddJobPostingInput,
  type AddJobPostingOutput,
  type CompanyProfileRecord,
  type CompanyProfileView,
  type CoverageInput,
  type CoverageOutput,
  type GetCompanyInput,
  type GetCompanyOutput,
  type JobPostingRecord,
  type JobPostingView,
  type ListCompaniesInput,
  type ListCompaniesOutput,
  type ListJobPostingsInput,
  type ListJobPostingsOutput,
  type RegisterCompanyInput,
  type RegisterCompanyOutput,
} from "./types.js";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

async function exists(e: Etzhayyim, collection: string, rkey: string): Promise<boolean> {
  const resp = await e.read({ collection, rkey }).catch(() => ({ records: [] }));
  return Boolean(resp.records[0]?.value);
}

async function scanAll<T>(e: Etzhayyim, collection: string, maxScan: number, onRow: (v: T) => void): Promise<number> {
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<T>({ collection, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      onRow(r.value);
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return scanned;
}

// ─── Company profile ────────────────────────────────────────────────

export async function registerCompany(e: Etzhayyim, input: RegisterCompanyInput): Promise<RegisterCompanyOutput> {
  if (!input.companyId || !input.name || !input.sourceUrl) return { status: "rejected", error: "missingRequiredFields" };
  const country = input.country?.toUpperCase();
  if (!isCountryCode(country ?? "")) return { status: "rejected", error: "invalidCountry" };
  if (input.sizeBucket && !SIZE_BUCKETS.has(input.sizeBucket)) return { status: "rejected", error: "invalidSizeBucket" };
  const rkey = companyRkey(input.companyId);
  const existing = await e.read<CompanyProfileRecord>({ collection: COMPANY_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", companyUri: existing.records[0].uri, did: existing.records[0].value.did, companyId: input.companyId };
  }
  const did = companyDidFor(input.companyId);
  const record: CompanyProfileRecord = {
    did,
    companyId: input.companyId,
    name: input.name,
    isicCode: input.isicCode,
    country: country!,
    region: input.region,
    sizeBucket: input.sizeBucket,
    legalEntityRef: input.legalEntityRef,
    website: input.website,
    sourceRegistry: input.sourceRegistry,
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: COMPANY_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "registered", companyUri: receipt.uri, did, companyId: input.companyId };
}

export async function getCompany(e: Etzhayyim, input: GetCompanyInput): Promise<GetCompanyOutput> {
  if (!input.companyId) return { error: "invalidCompanyId" };
  const resp = await e.read<CompanyProfileRecord>({ collection: COMPANY_COLLECTION, rkey: companyRkey(input.companyId) }).catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { company: { ...r.value, companyUri: r.uri } };
}

export async function listCompanies(e: Etzhayyim, input: ListCompaniesInput = {}): Promise<ListCompaniesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<CompanyProfileRecord>({ collection: COMPANY_COLLECTION, cursor: input.cursor, limit });
  const q = input.q?.toLowerCase();
  const country = input.country?.toUpperCase();
  const items: CompanyProfileView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (country && v.country !== country) return false;
      if (input.isicCode && v.isicCode !== input.isicCode) return false;
      if (input.sizeBucket && v.sizeBucket !== input.sizeBucket) return false;
      if (q && !v.name.toLowerCase().includes(q)) return false;
      return true;
    })
    .map((r) => ({ ...r.value, companyUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Job posting ────────────────────────────────────────────────────

export async function addJobPosting(e: Etzhayyim, input: AddJobPostingInput): Promise<AddJobPostingOutput> {
  if (!input.postingId || !input.companyId || !input.title || !input.postedAt || !input.sourceUrl) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const country = input.country?.toUpperCase();
  if (!isCountryCode(country ?? "")) return { status: "rejected", error: "invalidCountry" };
  if (!EMPLOYMENT_TYPES.has(input.employmentType)) return { status: "rejected", error: "invalidEmploymentType" };
  if (input.salaryMinJpy != null && !isUintString(input.salaryMinJpy)) return { status: "rejected", error: "salaryMinJpyMustBeUintString" };
  if (input.salaryMaxJpy != null && !isUintString(input.salaryMaxJpy)) return { status: "rejected", error: "salaryMaxJpyMustBeUintString" };
  if (!(await exists(e, COMPANY_COLLECTION, companyRkey(input.companyId)))) {
    return { status: "companyNotFound", error: `companyNotFound:${input.companyId}` };
  }
  const rkey = postingRkey(input.postingId);
  const existing = await e.read<JobPostingRecord>({ collection: JOB_POSTING_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", postingUri: existing.records[0].uri, did: existing.records[0].value.did, postingId: input.postingId };
  }
  const did = postingDidFor(input.postingId);
  const record: JobPostingRecord = {
    did,
    postingId: input.postingId,
    companyId: input.companyId,
    title: input.title,
    iscoCode: input.iscoCode,
    country: country!,
    region: input.region,
    employmentType: input.employmentType,
    remote: input.remote,
    salaryMinJpy: input.salaryMinJpy,
    salaryMaxJpy: input.salaryMaxJpy,
    postedAt: input.postedAt,
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: JOB_POSTING_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "added", postingUri: receipt.uri, did, postingId: input.postingId };
}

export async function listJobPostings(e: Etzhayyim, input: ListJobPostingsInput = {}): Promise<ListJobPostingsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<JobPostingRecord>({ collection: JOB_POSTING_COLLECTION, cursor: input.cursor, limit });
  const q = input.q?.toLowerCase();
  const country = input.country?.toUpperCase();
  const items: JobPostingView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.companyId && v.companyId !== input.companyId) return false;
      if (country && v.country !== country) return false;
      if (input.iscoCode && v.iscoCode !== input.iscoCode) return false;
      if (input.employmentType && v.employmentType !== input.employmentType) return false;
      if (input.remote != null && v.remote !== input.remote) return false;
      if (q && !v.title.toLowerCase().includes(q)) return false;
      return true;
    })
    .map((r) => ({ ...r.value, postingUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Coverage ───────────────────────────────────────────────────────

export async function coverage(e: Etzhayyim, input: CoverageInput = {}): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const companiesByCountry: Record<string, number> = {};
  const postingsByEmploymentType: Record<string, number> = {};
  const companyCount = await scanAll<CompanyProfileRecord>(e, COMPANY_COLLECTION, maxScan, (v) => {
    companiesByCountry[v.country] = (companiesByCountry[v.country] ?? 0) + 1;
  });
  const jobPostingCount = await scanAll<JobPostingRecord>(e, JOB_POSTING_COLLECTION, maxScan, (v) => {
    postingsByEmploymentType[v.employmentType] = (postingsByEmploymentType[v.employmentType] ?? 0) + 1;
  });
  return {
    companyCount,
    jobPostingCount,
    companiesByCountry,
    postingsByEmploymentType,
    truncated: companyCount >= maxScan || jobPostingCount >= maxScan,
  };
}
