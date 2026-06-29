/**
 * The runtime schema source for YAML cell-option completion (Phase 6d plan §5.3,
 * Slice 6d-3) — the impure adapter that reads the user's INSTALLED Quarto schema
 * and hands the pure provider a `SchemaIndex`.
 *
 * It runtime-reads `<share>/editor/tools/yaml/yaml-intelligence-resources.json`
 * (resolved via `quarto --paths`), which is MIT-licensed and ships in the Quarto
 * CLI the extension already depends on — so there is zero version drift, zero
 * bundle weight, and nothing redistributed (no NOTICE; plan §2). Every failure
 * mode — Quarto absent, `--paths` shape changed, file missing/unreadable, JSON
 * malformed — degrades to the curated fallback (`CURATED_SCHEMA_INDEX`), never an
 * error: completion-only data must never break editing (Learning #16).
 *
 * The load is performed once per session and cached (the share lookup spawns the
 * CLI and the file is ~680 KB, far too costly per keystroke). Picking up a Quarto
 * install/upgrade made mid-session requires a window reload — an accepted v1
 * limitation.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CURATED_SCHEMA_INDEX,
  parseSchemaIndex,
  type SchemaIndex,
} from "../core/yaml-schema";
import { quartoSharePath } from "../quarto/cli";

/** The schema file's path relative to the Quarto share directory. */
const SCHEMA_RELATIVE_PATH = path.join(
  "editor",
  "tools",
  "yaml",
  "yaml-intelligence-resources.json",
);

/** Read + parse the installed schema, degrading to the curated fallback on any failure. */
async function loadSchemaIndex(): Promise<SchemaIndex> {
  try {
    const share = await quartoSharePath();
    const file = path.join(share, SCHEMA_RELATIVE_PATH);
    const text = await fs.readFile(file, "utf8");
    // `parseSchemaIndex` is pure and never throws — a malformed/unexpected file
    // already degrades to the curated fallback inside it.
    return parseSchemaIndex(text);
  } catch {
    // Quarto not found, `--paths` failed, or the file is missing/unreadable.
    return CURATED_SCHEMA_INDEX;
  }
}

/** A lazily-loaded, session-cached cell-option schema source. */
export interface SchemaSource {
  /**
   * The cell-option schema index, loaded once and cached for the session. Always
   * resolves (never rejects) — to the parsed schema, or the curated fallback.
   */
  getIndex(): Promise<SchemaIndex>;
}

/** Create a schema source whose first `getIndex()` triggers the (cached) load. */
export function createSchemaSource(): SchemaSource {
  let cached: Promise<SchemaIndex> | undefined;
  return {
    getIndex() {
      return (cached ??= loadSchemaIndex());
    },
  };
}
