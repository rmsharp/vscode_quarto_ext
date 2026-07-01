/**
 * Pure, `vscode`-free per-format option scoping (Phase 6d-6+ (b2) plan §2.2/§5.2).
 *
 * Quarto scopes an option to a set of output formats via each option's
 * `tags.formats` list, whose entries are concrete format names (`revealjs`),
 * `$`-prefixed alias-group references (`$pdf-all`), and `!`-negations (`!man`,
 * `!$docbook-all`). The alias groups live in `schema/format-aliases.yml` (a closed
 * ~14-entry table, recursively nested — e.g. `html-all` → `[$html-files, $epub-all]`).
 *
 * `formatMatches` decides whether an option is valid for a concrete format,
 * mirroring Quarto's own `getFormatSchema`/`useSchema`: valid iff the option is
 * UNTAGGED (format-agnostic), or no `!`-negated tag matches AND (there is no
 * positive tag, or a positive tag matches). Both these functions are pure and
 * never throw — completion-only data must never break editing (Learning #16).
 */

/**
 * Alias-group name (stored WITHOUT the leading `$`) → its member format names.
 * Members are concrete names or `$`-prefixed references to other groups.
 */
export type FormatAliases = Map<string, string[]>;

/**
 * Recursively flatten `names` — a list of concrete format names and `$`-alias
 * references — into the set of concrete format names, expanding each `$`-alias
 * through `aliases`. An unknown `$`-alias contributes its bare name (never
 * throws). Cycle-guarded via a shared `seen` set of expanded alias names, so a
 * self-referential table terminates.
 */
export function expandFormatAliases(
  names: string[],
  aliases: FormatAliases,
): Set<string> {
  const out = new Set<string>();
  const seen = new Set<string>();
  const visit = (list: string[]): void => {
    for (const name of list) {
      if (name.startsWith("$")) {
        const group = name.slice(1);
        if (seen.has(group)) {
          continue;
        }
        seen.add(group);
        const members = aliases.get(group);
        if (members !== undefined) {
          visit(members);
        } else {
          out.add(group); // unknown alias → treat the bare name as concrete
        }
      } else {
        out.add(name);
      }
    }
  };
  visit(names);
  return out;
}

/**
 * Whether an option whose `tags.formats` is `tagsFormats` is valid for the
 * concrete output format `format`, expanding alias groups through `aliases`
 * (Quarto `useSchema` semantics):
 *   - `undefined` (untagged) → universal, valid for every format;
 *   - if a `!`-negated tag expands to include `format` → invalid;
 *   - else if there is NO positive tag → valid (negation-only = all-except);
 *   - else valid iff a positive tag expands to include `format`.
 */
export function formatMatches(
  tagsFormats: string[] | undefined,
  format: string,
  aliases: FormatAliases,
): boolean {
  if (tagsFormats === undefined) {
    return true; // untagged = universal
  }
  const disabled = expandFormatAliases(
    tagsFormats.filter((t) => t.startsWith("!")).map((t) => t.slice(1)),
    aliases,
  );
  if (disabled.has(format)) {
    return false;
  }
  const enabled = expandFormatAliases(
    tagsFormats.filter((t) => !t.startsWith("!")),
    aliases,
  );
  if (enabled.size === 0) {
    return true; // only negations → all formats except the negated ones
  }
  return enabled.has(format);
}
