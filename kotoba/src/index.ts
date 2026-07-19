/**
 * shigotoba (仕事場) kotoba — barrel.
 *
 * Per ADR-2606011400. Public business-establishment registry + job-board
 * open-data on the etzhayyim substrate (AT PDS records; no RW).
 *
 *   companyProfile : registerCompany / getCompany / listCompanies (q = name search)
 *   jobPosting     : addJobPosting (FK→company) / listJobPostings (q = title search)
 *   coverage
 *
 * (a) etzhayyim front. Employer-side public data only (no job-seeker PII). The
 * `summarize` LLM proxy is AI compute and stays etzhayyim.
 */

export * from "./types.js";
export {
  registerCompany,
  getCompany,
  listCompanies,
  addJobPosting,
  listJobPostings,
  coverage,
} from "./registry.js";
