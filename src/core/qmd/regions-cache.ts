/**
 * The replacement policy of the model's scan cache (`regionsCache` in `qmd/model.ts`): which of the scans of the last few
 * (text, engine, mode) keys are kept after a hit or a miss. Pure and generic over the entry, so the policy is read and
 * tested apart from the scan; the cache itself stays where the scan is.
 *
 * ⚠ Before Session 343 the cache held two entries, whatever their size, and nothing else was kept. It holds up to four now (least recently
 * used out), under a memory bound: the two most recent whatever their size, the third and fourth only while the held texts total at most
 * `REGIONS_CACHE_TEXT_BUDGET` characters.
 */

/** What a cache keeps. */
export interface CacheLimits {
  /** The most recent entries kept whatever their size: today's two (one document asked under its engine-blind and its engine-aware key). */
  readonly alwaysKept: number;
  /** The most entries kept at all. */
  readonly maxEntries: number;
  /** Past `alwaysKept` entries are kept only while the total LENGTH of all the held texts is at most this: a megabytes-sized document keeps today's two. Entries holding one string are counted each. */
  readonly textBudget: number;
}

/** The entries always kept: the two most recent. */
export const REGIONS_CACHE_ALWAYS_KEPT = 2;
/** The most entries kept: a second visible `.qmd` under both of its keys beside the first under both of its. */
export const REGIONS_CACHE_MAX_ENTRIES = 4;
/** The most characters of text the held entries may total once there are more than `REGIONS_CACHE_ALWAYS_KEPT` of them: 8,388,608, an 8 MiB document's worth. */
export const REGIONS_CACHE_TEXT_BUDGET = 8_388_608;

export const REGIONS_CACHE_LIMITS: CacheLimits = {
  alwaysKept: REGIONS_CACHE_ALWAYS_KEPT,
  maxEntries: REGIONS_CACHE_MAX_ENTRIES,
  textBudget: REGIONS_CACHE_TEXT_BUDGET,
};

/** The entries after a HIT on `entries[at]`: that entry first, the others in their order. A new array; an index outside the list changes nothing. */
export function promoted<E>(entries: readonly E[], at: number): E[] {
  if (at <= 0 || at >= entries.length) return entries.slice();
  return [entries[at], ...entries.slice(0, at), ...entries.slice(at + 1)];
}

/**
 * The entries after a MISS made `fresh`: it goes first, and the oldest are dropped from the back while there are more than `limits.alwaysKept` of them and either there are more than `limits.maxEntries` or the held texts
 * total more than `limits.textBudget` characters. The new entry is never dropped, nor are the `alwaysKept - 1` before it. A new array.
 */
export function admitted<E extends { readonly text: string }>(entries: readonly E[], fresh: E, limits: CacheLimits = REGIONS_CACHE_LIMITS): E[] {
  const held = [fresh, ...entries];
  let total = held.reduce((sum, e) => sum + e.text.length, 0);
  while (held.length > limits.alwaysKept && (held.length > limits.maxEntries || total > limits.textBudget)) {
    total -= (held.pop() as E).text.length;
  }
  return held;
}
