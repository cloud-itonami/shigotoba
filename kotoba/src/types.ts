/**
 * shigotoba (仕事場) kotoba — business-establishment registry + job-board open-data.
 *
 * Per ADR-2606011400 (Consensys pattern) + ADR-2605172400 (3-axis OR-test).
 *
 * AXIS NOTE: (a) axis-clean public open-data — business-establishment registry
 * (ILO + national business registries) + employer-side job postings. The
 * collections model PUBLIC employer data (company profiles + listings), not job
 * seekers: no applicant / resume / PII custody, no settlement (salary ranges are
 * published listing data, not money movement), no fulfillment liability. The
 * `summarize` LLM proxy is AI compute and stays etzhayyim; the catalog migrates.
 *
 * Cross-actor refs (external, kept as opaque strings — NOT FKs into this app):
 *   legalEntityRef → legal-entity (parent corporate identity)
 *   isicCode       → isic (ISIC Rev.4 industry classification)
 *   iscoCode       → isco (occupation classification)
 *
 * AT-Lexicon: no float. Salary ranges are decimal STRINGS in JPY. Booleans
 * (remote) are allowed. Headcount is a coarse size BUCKET (never raw counts).
 *
 * Identity hierarchy:
 *   did:web:shigotoba.etzhayyim.com                       — controller
 *   did:web:shigotoba.etzhayyim.com:co:{companyId}        — a company / establishment
 *   did:web:shigotoba.etzhayyim.com:job:{postingId}       — a job posting
 */

export const SHIGOTOBA_DID_PREFIX = "did:web:shigotoba.etzhayyim.com:" as const;

export const COMPANY_COLLECTION = "com.etzhayyim.apps.shigotoba.companyProfile";
export const JOB_POSTING_COLLECTION = "com.etzhayyim.apps.shigotoba.jobPosting";

// ─── Enums ──────────────────────────────────────────────────────────

export type SizeBucket = "micro" | "small" | "medium" | "large" | "enterprise";
export type EmploymentType = "full-time" | "part-time" | "contract" | "temporary" | "internship" | "other";

export const SIZE_BUCKETS: ReadonlySet<string> = new Set(["micro", "small", "medium", "large", "enterprise"]);
export const EMPLOYMENT_TYPES: ReadonlySet<string> = new Set([
  "full-time",
  "part-time",
  "contract",
  "temporary",
  "internship",
  "other",
]);

// ─── Company profile (establishment) ────────────────────────────────

export interface CompanyProfileRecord {
  did: string;
  companyId: string;
  name: string;
  /** ISIC Rev.4 industry code (external ref), optional. */
  isicCode?: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  region?: string;
  sizeBucket?: SizeBucket;
  /** External legal-entity reference (opaque string), optional. */
  legalEntityRef?: string;
  website?: string;
  sourceRegistry?: string;
  sourceUrl: string;
  createdAt: string;
}
export interface CompanyProfileView extends CompanyProfileRecord {
  companyUri: string;
}
export interface RegisterCompanyInput {
  companyId: string;
  name: string;
  country: string;
  sourceUrl: string;
  isicCode?: string;
  region?: string;
  sizeBucket?: SizeBucket;
  legalEntityRef?: string;
  website?: string;
  sourceRegistry?: string;
}
export interface RegisterCompanyOutput {
  status: "registered" | "alreadyExists" | "rejected";
  companyUri?: string;
  did?: string;
  companyId?: string;
  error?: string;
}
export interface GetCompanyInput {
  companyId: string;
}
export interface GetCompanyOutput {
  company?: CompanyProfileView;
  error?: string;
}
export interface ListCompaniesInput {
  country?: string;
  isicCode?: string;
  sizeBucket?: SizeBucket;
  /** App-layer substring search over name. */
  q?: string;
  limit?: number;
  cursor?: string;
}
export interface ListCompaniesOutput {
  items: CompanyProfileView[];
  cursor?: string;
  total: number;
}

// ─── Job posting ────────────────────────────────────────────────────

export interface JobPostingRecord {
  did: string;
  postingId: string;
  /** FK → company. */
  companyId: string;
  title: string;
  /** ISCO occupation code (external ref), optional. */
  iscoCode?: string;
  country: string;
  region?: string;
  employmentType: EmploymentType;
  remote?: boolean;
  /** Salary band, JPY (decimal strings), optional. */
  salaryMinJpy?: string;
  salaryMaxJpy?: string;
  postedAt: string;
  sourceUrl: string;
  createdAt: string;
}
export interface JobPostingView extends JobPostingRecord {
  postingUri: string;
}
export interface AddJobPostingInput {
  postingId: string;
  companyId: string;
  title: string;
  country: string;
  employmentType: EmploymentType;
  postedAt: string;
  sourceUrl: string;
  iscoCode?: string;
  region?: string;
  remote?: boolean;
  salaryMinJpy?: string;
  salaryMaxJpy?: string;
}
export interface AddJobPostingOutput {
  status: "added" | "alreadyExists" | "rejected" | "companyNotFound";
  postingUri?: string;
  did?: string;
  postingId?: string;
  error?: string;
}
export interface ListJobPostingsInput {
  companyId?: string;
  country?: string;
  iscoCode?: string;
  employmentType?: EmploymentType;
  remote?: boolean;
  /** App-layer substring search over title. */
  q?: string;
  limit?: number;
  cursor?: string;
}
export interface ListJobPostingsOutput {
  items: JobPostingView[];
  cursor?: string;
  total: number;
}

// ─── Coverage ───────────────────────────────────────────────────────

export interface CoverageInput {
  maxScan?: number;
}
export interface CoverageOutput {
  companyCount?: number;
  jobPostingCount?: number;
  companiesByCountry?: Record<string, number>;
  postingsByEmploymentType?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Validation + helpers ───────────────────────────────────────────

export function isCountryCode(s: string): boolean {
  return /^[A-Z]{2}$/.test(s);
}
export function isUintString(s: string): boolean {
  return /^\d+$/.test(s);
}

export function companyDidFor(id: string): string {
  return `${SHIGOTOBA_DID_PREFIX}co:${id.toLowerCase()}`;
}
export function companyRkey(id: string): string {
  return `co-${id.toLowerCase()}`;
}
export function postingDidFor(id: string): string {
  return `${SHIGOTOBA_DID_PREFIX}job:${id.toLowerCase()}`;
}
export function postingRkey(id: string): string {
  return `job-${id.toLowerCase()}`;
}
