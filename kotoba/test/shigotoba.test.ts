import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  registerCompany,
  getCompany,
  listCompanies,
  addJobPosting,
  listJobPostings,
  coverage,
} from "../src/index.js";

const SRC = "https://www.ilo.org/establishment/example";

describe("shigotoba kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:shigotoba.etzhayyim.com" });
  });

  describe("company registry", () => {
    it("registers (country + sizeBucket validated), reads, lists, searches", async () => {
      expect((await registerCompany(e, { companyId: "C-1", name: "Acme Manufacturing KK", country: "jp", isicCode: "C25", sizeBucket: "large", legalEntityRef: "did:web:legal-entity.etzhayyim.com:entity:e-1", sourceUrl: SRC })).status).toBe("registered");
      expect((await getCompany(e, { companyId: "C-1" })).company?.country).toBe("JP");
      expect((await registerCompany(e, { companyId: "C-X", name: "x", country: "JPN", sourceUrl: SRC })).status).toBe("rejected"); // country 3-letter
      expect((await registerCompany(e, { companyId: "C-Y", name: "y", country: "JP", sizeBucket: "galactic" as any, sourceUrl: SRC })).status).toBe("rejected"); // sizeBucket
      await registerCompany(e, { companyId: "C-2", name: "Beta Foods Ltd", country: "GB", sourceUrl: SRC });
      expect((await listCompanies(e, { country: "JP" })).total).toBe(1);
      expect((await listCompanies(e, { q: "beta" })).total).toBe(1);
      expect((await listCompanies(e, { sizeBucket: "large" })).total).toBe(1);
    });
  });

  describe("job postings FK to company", () => {
    beforeEach(async () => {
      await registerCompany(e, { companyId: "C-1", name: "Acme", country: "JP", sourceUrl: SRC });
    });
    it("adds postings (FK→company, employmentType + salary-string validated)", async () => {
      expect((await addJobPosting(e, { postingId: "J-1", companyId: "C-1", title: "Senior Robotics Engineer", country: "jp", employmentType: "full-time", iscoCode: "2144", remote: true, salaryMinJpy: "6000000", salaryMaxJpy: "9000000", postedAt: "2026-05-30", sourceUrl: SRC })).status).toBe("added");
      expect((await addJobPosting(e, { postingId: "J-X", companyId: "C-1", title: "x", country: "JP", employmentType: "gig" as any, postedAt: "x", sourceUrl: SRC })).status).toBe("rejected"); // employmentType
      expect((await addJobPosting(e, { postingId: "J-F", companyId: "C-1", title: "f", country: "JP", employmentType: "contract", salaryMinJpy: "5.5", postedAt: "x", sourceUrl: SRC })).status).toBe("rejected"); // salary float-string
      expect((await addJobPosting(e, { postingId: "J-G", companyId: "GHOST", title: "g", country: "JP", employmentType: "contract", postedAt: "x", sourceUrl: SRC })).status).toBe("companyNotFound");
      expect((await listJobPostings(e, { companyId: "C-1", remote: true })).total).toBe(1);
      expect((await listJobPostings(e, { q: "robotics" })).total).toBe(1);
    });
    it("coverage rolls up companies + postings by country / employment type", async () => {
      await registerCompany(e, { companyId: "C-2", name: "Gamma", country: "US", sourceUrl: SRC });
      await addJobPosting(e, { postingId: "J-1", companyId: "C-1", title: "A", country: "JP", employmentType: "full-time", postedAt: "2026-05-30", sourceUrl: SRC });
      await addJobPosting(e, { postingId: "J-2", companyId: "C-1", title: "B", country: "JP", employmentType: "part-time", postedAt: "2026-05-30", sourceUrl: SRC });
      const cov = await coverage(e);
      expect(cov.companyCount).toBe(2);
      expect(cov.jobPostingCount).toBe(2);
      expect(cov.companiesByCountry?.JP).toBe(1);
      expect(cov.companiesByCountry?.US).toBe(1);
      expect(cov.postingsByEmploymentType?.["full-time"]).toBe(1);
    });
  });
});
