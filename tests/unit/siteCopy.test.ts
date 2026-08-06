import { describe, expect, it } from "vitest";
import { buildShareHref, SHARE_SUMMARY } from "@/app/components/SocialShare";
import {
  SITE_DESCRIPTION,
  SITE_SOCIAL_DESCRIPTION,
  SITE_TITLE,
} from "@/app/lib/siteCopy";

const LEGACY_PUBLIC_CLAIM_PATTERN =
  /real[- ]?time|public opinion intelligence|interactive data visuali[sz]ations|electoral commission|ipsos/i;

describe("public site copy", () => {
  it("uses the evidence-first proposition consistently", () => {
    expect(SITE_TITLE).toBe("public-data.org — UK Public Evidence");
    expect(SITE_DESCRIPTION).toMatch(/UK figures/i);
    expect(SITE_DESCRIPTION).toMatch(/original publication/i);
    expect(SITE_SOCIAL_DESCRIPTION).toMatch(/original evidence/i);
    expect(SHARE_SUMMARY).toBe(SITE_SOCIAL_DESCRIPTION);
  });

  it("does not restore legacy real-time, count or publisher claims", () => {
    for (const value of [SITE_TITLE, SITE_DESCRIPTION, SITE_SOCIAL_DESCRIPTION, SHARE_SUMMARY]) {
      expect(value).not.toMatch(LEGACY_PUBLIC_CLAIM_PATTERN);
    }
  });

  it("builds share copy from the same truthful public contract", () => {
    const href = buildShareHref("X", SITE_TITLE, "https://example.test/evidence");
    const url = new URL(href);
    const text = url.searchParams.get("text") ?? "";

    expect(text).toContain(SITE_TITLE);
    expect(text).toContain(SITE_SOCIAL_DESCRIPTION);
    expect(text).not.toMatch(LEGACY_PUBLIC_CLAIM_PATTERN);
    expect(url.searchParams.get("url")).toBe("https://example.test/evidence");
  });

  it("does not duplicate punctuation in article and question titles", () => {
    for (const title of ["Is inflation falling?", "A new publication.", "Read this!"]) {
      const href = buildShareHref("X", title, "https://example.test/evidence");
      const text = new URL(href).searchParams.get("text");
      expect(text).toBe(`${title} ${SHARE_SUMMARY}`);
    }
  });
});
