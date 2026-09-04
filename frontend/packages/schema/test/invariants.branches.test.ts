// packages/schema/test/invariants.branches.test.ts — ramas de invariants.ts no alcanzadas por
// golden/invariants/ (richTextLength con estructura parcial; TemplateManifest.description presente).
import { describe, it, expect } from "vitest";
import { richTextLength, validateManifest } from "../src/invariants.ts";
import { textSpec, sectionSpec, manifestFixture, themeFixture, defaultsFixture, loc } from "../scripts/fixtures.ts";

describe("richTextLength — estructura parcial", () => {
  it("doc sin content: 0", () => {
    expect(richTextLength({})).toBe(0);
  });
  it("párrafo sin content: 0", () => {
    expect(richTextLength({ content: [{}] })).toBe(0);
  });
  it("span sin text: 0", () => {
    expect(richTextLength({ content: [{ content: [{}] }] })).toBe(0);
  });
  it("cuenta texto real", () => {
    expect(richTextLength({ content: [{ content: [{ text: "abc" }] }] })).toBe(3);
  });
});

describe("validateManifest — description presente (I-27 también aplica a description)", () => {
  const theme = themeFixture();
  it("description con todos los locales: no viola", () => {
    const m = {
      ...manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")])]),
      description: loc("Una boda"),
    };
    const v = validateManifest(m, theme, defaultsFixture(m, {}));
    expect(v.some(x => x.path === "description")).toBe(false);
  });
  it("description sin en-US declarado: viola I-27", () => {
    const m = {
      ...manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")])], { locales: ["es-MX", "en-US"] }),
      description: loc("Una boda"),
      name: loc("T", { "en-US": "T" }),
      sections: [{ ...sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")]), title: loc("cover", { "en-US": "cover" }) }],
    };
    const v = validateManifest(m as any, theme, defaultsFixture(m as any, {}));
    expect(v.some(x => x.code === "I-27_LOCALIZED_TEXT_MISSING_LOCALE" && x.path === "description")).toBe(true);
  });
});
