// test/fixtures/manifest.test.ts — guarda que el fixture sigue siendo un `TemplateManifest` válido
// (mismo esquema que usará el servidor cuando publique el campo `manifest`, `lib/manifest.ts`).
import { describe, expect, it } from "vitest";
import { CLAVE_BODA_CLASICA, MANIFEST_BODA_CLASICA } from "./manifest.ts";

describe("fixture boda-clasica@1.0.0 (manifiesto REAL leído de tpl_template_version)", () => {
  it("valida contra TemplateManifest y trae las 12 secciones", () => {
    expect(MANIFEST_BODA_CLASICA.sections).toHaveLength(12);
    expect(CLAVE_BODA_CLASICA).toBe("boda-clasica@1.0.0");
  });

  it("cover.date es de solo lectura (source: business)", () => {
    const cover = MANIFEST_BODA_CLASICA.sections.find((s) => s.key === "cover")!;
    const fecha = cover.blocks.find((b) => b.id === "cover.date")!;
    expect(fecha.source).toBe("business");
    expect(fecha.editable).toBe(false);
  });

  it("gallery.photos es un grupo con rol galleryPhotos (PhotoManager)", () => {
    const gallery = MANIFEST_BODA_CLASICA.sections.find((s) => s.key === "gallery")!;
    const fotos = gallery.blocks.find((b) => b.id === "gallery.photos")!;
    expect(fotos.type).toBe("group");
    expect(fotos.role).toBe("galleryPhotos");
  });
});
