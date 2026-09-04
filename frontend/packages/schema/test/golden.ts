// packages/schema/test/golden.ts — loader de golden/ (06 §3).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../golden/", import.meta.url));
export const goldenDir = (sub: string): string => ROOT + sub;
export const loadCases = <T>(sub: string, file: string): T[] =>
  JSON.parse(readFileSync(ROOT + sub + "/" + file, "utf8"));
export const loadJson = <T>(relPath: string): T => JSON.parse(readFileSync(ROOT + relPath, "utf8"));
export const listCases = (sub: string): string[] =>
  readdirSync(ROOT + sub).filter(f => f.endsWith(".json")).sort();
export const listDirs = (sub: string): string[] =>
  readdirSync(ROOT + sub, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
