// packages/schema/test/compose.branches.test.ts — casos unitarios (no golden) que completan las
// ramas de compose.ts no alcanzadas por golden/templates/ (los 2 ejemplos no cubren, por ejemplo,
// un grupo `required` vacío, o un bloque `business` requerido con dato de negocio ausente).
// Umbral de ramas de packages/schema: 85% (contratos.md §6).
import { describe, it, expect } from "vitest";
import { compose, type TemplatePackage } from "../src/compose.ts";
import {
  textSpec, groupSpec, sectionSpec, manifestFixture, themeFixture, defaultsFixture,
  documentFixture, textValue, groupValue, groupItem, ulid,
} from "../scripts/fixtures.ts";
import type { BusinessSnapshot, AssetIndex } from "../src/composed.ts";
import type { BlockSpec } from "../src/blocks.ts";

const business: BusinessSnapshot = {
  invitationId: 1, date: "2026-01-01", time: "12:00", hashtag: null, coverPhotoUrl: null,
  childrenAllowed: true, youngAllowed: true, eventKind: "generic", planTier: 1, timezone: "America/Mexico_City",
};
const assets: AssetIndex = {};

describe("compose — grupo required", () => {
  const inner = [textSpec("title", "sectionTitle")] as BlockSpec[];
  const grp = groupSpec("event.cards", "eventCards", inner, { required: true, min: 0, max: 4 }) as BlockSpec;
  const manifest = manifestFixture([sectionSpec("event", "event", [grp])]);
  const theme = themeFixture();

  it("sin contenido ni default: items=[] y missingRequired (rama 154)", () => {
    const defaults = defaultsFixture(manifest, {});
    const doc = documentFixture(manifest, theme, { content: {} });
    const pkg: TemplatePackage = { manifest, theme, defaults };
    const { report, composed } = compose(pkg, doc, business, assets, "es-MX");
    expect(report.missingRequired).toEqual(["event.cards"]);
    expect(report.stillDefault).toEqual([]);
    const group = composed.sections[0]!.blocks[0] as any;
    expect(group.items).toEqual([]);
  });

  it("con default no vacío: stillDefault y no missingRequired (rama 155)", () => {
    const defaults = defaultsFixture(manifest, {
      "event.cards": groupValue([groupItem(ulid("d1"), { title: textValue("Demo") })]),
    });
    const doc = documentFixture(manifest, theme, { content: {} });
    const pkg: TemplatePackage = { manifest, theme, defaults };
    const { report } = compose(pkg, doc, business, assets, "es-MX");
    expect(report.missingRequired).toEqual([]);
    expect(report.stillDefault).toEqual(["event.cards"]);
  });
});

describe("compose — bloque business required sin dato (rama 161)", () => {
  const biz = textSpec("cover.hashtag", "hashtag", { required: true, source: "business", businessField: "invitation.hashtag" }) as BlockSpec;
  const manifest = manifestFixture([sectionSpec("cover", "cover", [biz])]);
  const theme = themeFixture();
  const defaults = defaultsFixture(manifest, {});
  const doc = documentFixture(manifest, theme, {});

  it("business.hashtag es null: missingRequired y provenance empty", () => {
    const pkg: TemplatePackage = { manifest, theme, defaults };
    const { report, composed } = compose(pkg, doc, business, assets, "es-MX");
    expect(report.missingRequired).toEqual(["cover.hashtag"]);
    const block = composed.sections[0]!.blocks[0] as any;
    expect(block.provenance).toBe("empty");
    expect(block.value).toBeNull();
  });
});

describe("compose — escalar required (ramas 171-172)", () => {
  const theme = themeFixture();

  it("sin user ni default: missingRequired (rama 171)", () => {
    const spec = textSpec("cover.title", "coverTitle", { required: true }) as BlockSpec;
    const manifest = manifestFixture([sectionSpec("cover", "cover", [spec])]);
    const defaults = defaultsFixture(manifest, {});
    const doc = documentFixture(manifest, theme, { content: {} });
    const pkg: TemplatePackage = { manifest, theme, defaults };
    const { report } = compose(pkg, doc, business, assets, "es-MX");
    expect(report.missingRequired).toEqual(["cover.title"]);
    expect(report.stillDefault).toEqual([]);
  });

  it("con default y sin user: stillDefault (rama 172, H-03)", () => {
    const spec = textSpec("cover.title", "coverTitle", { required: true }) as BlockSpec;
    const manifest = manifestFixture([sectionSpec("cover", "cover", [spec])]);
    const defaults = defaultsFixture(manifest, { "cover.title": textValue("Demo") });
    const doc = documentFixture(manifest, theme, { content: {} });
    const pkg: TemplatePackage = { manifest, theme, defaults };
    const { report } = compose(pkg, doc, business, assets, "es-MX");
    expect(report.missingRequired).toEqual([]);
    expect(report.stillDefault).toEqual(["cover.title"]);
  });
});
