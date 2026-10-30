import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { buildOutline, findAllCells, findBodyLines, legacyDivCalloutTitleSlot, legacyDivPanelTabset } from "../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../src/core/refs";
import { CJK, doc, FORMS, flat, LIMIT_MS, LONG, names, plainAnswers, READERS, timed } from "./support/s338-div-word";

// Session 338, part B of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" (group g02, site 3). `legacyDivCalloutTitleSlot` and `legacyDivPanelTabset` (model.ts) each
// test whether the attribute text of a fenced div's opener is ONE BARE WORD (`::: callout-note`, Pandoc's `::: foo` = `::: {.foo}`) with the whole-string pattern `/^[\p{L}\p{N}_-]+$/u`. V8 keeps one entry of its
// regex backtrack stack per character of a class-plus, twice as large once the line holds a character above U+00FF (the subject is then stored with two bytes a character), so an opener whose word has
// 4,194,288 letters or more throws `RangeError: Maximum call stack size exceeded` and the error reaches every reader of the document (the Outline, the cells, the label index, the engine resolver). A line of
// characters up to U+00FF never throws (measured at HEAD fe6aaec: 70,000,000 `a`, 20,000,000 `é`), so the rows of that form PASS on the parent and are guards: they must keep their answer, and the time limit.
// Only a CommonMark-family reader reaches the legacy readers with a bare word: for the markdown reader `divSpecReading` reads the word from pandoc's own tokens and the legacy pattern is never asked
// (`from: commonmark`, `commonmark_x` and `gfm` are the three readers `FRONTMATTER_COMMONMARK_FROM` names). The rows of the long words in a document, one file for each reader, are
// `s338-div-word-rows-gfm.test.ts`, `-commonmark.test.ts` and `-commonmark-x.test.ts` (their documents and answers are in `support/s338-div-word.ts`).
//
// THE TWO FUNCTIONS HIDE EACH OTHER. `computeRegions` builds the entry of a div as one object literal whose `calloutTitleSlot` is evaluated BEFORE its `isTabset`, from the same opener, under the same
// reader, so no document reaches `legacyDivPanelTabset` without `legacyDivCalloutTitleSlot` throwing first: the last two groups call each function on its own (both are exported for these rows).
//
// WHAT THE ANSWER IS. A long word is neither `callout`, `callout-<type>` nor `panel-tabset`, so its div is a plain div and every heading inside it is a heading: the answer is what the same document gives with
// a four-letter word (`abcd`, the short control of the first group, which pins it too).

describe("the Session 338 clock helper", () => {
  it("timed reports the milliseconds the run took and hands back its result", () => {
    const { result, ms } = timed(() => {
      const started = Date.now();
      while (Date.now() - started < 30) {
        /* spin */
      }
      return "done";
    });
    expect(result).toBe("done");
    expect(ms).toBeGreaterThanOrEqual(25);
  });
});

describe("Session 338 — the short control: what a plain div, a callout and a tabset answer with a short word", () => {
  it.each(READERS.map((r) => [r.from, r] as const))("%s: a four-letter word is a plain div, and the document gives the plain answers", (_from, reader) => {
    const id = `s${reader.key}`;
    const text = doc(id, "abcd", reader.from);
    const want = plainAnswers(id);
    expect(names(text)).toEqual(want.headings);
    expect(flat(buildOutline(text))).toEqual(want.outline);
    expect(indexLabels(text).map((l) => [l.id, l.line])).toEqual(want.labels);
    expect(findLabel(text, `fig-${id}`)?.line).toBe(12);
    expect(findAllCells(text).map((c) => [c.lang, c.startLine, c.endLine])).toEqual([["r", 14, 17]]);
    expect(findBodyLines(text).map((b) => b.line)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 18, 19, 20]);
    expect(resolveDocumentEngine("a.qmd", text)).toBe("knitr");
  });

  // The words the legacy readers DO know, under the only one of the three readers that has fenced divs: `callout-note` takes the first heading into its title bar, `panel-tabset` makes its first heading a tab. They
  // pass on the parent and must keep passing: they are what the bare-word test is for.
  it("commonmark_x: `callout`, `callout-note` and `panel-tabset` are read as what they name (the heading is lifted into the title bar, or is a tab)", () => {
    for (const word of ["callout", "callout-note", "callout-tip", "panel-tabset"]) {
      expect(names(doc("sw", word, "commonmark_x")), word).toEqual(["Ksw", "Aftersw"]);
    }
  });

  it("commonmark_x: a word that only STARTS like them is a plain div (`callout-bogus`, `callout-notes`, `panel-tabsets`, `calloutnote`, `Panel-Tabset`, `callout_note`, `panel_tabset`)", () => {
    for (const word of ["callout-bogus", "callout-notes", "panel-tabsets", "calloutnote", "Panel-Tabset", "callout-note-2", "callout_note", "panel_tabset"]) {
      expect(names(doc("sx", word, "commonmark_x")), word).toEqual(["Hsx", "Ksx", "Aftersx"]);
    }
  });

  it("gfm and commonmark have no fenced divs: the words the legacy readers know change nothing", () => {
    for (const from of ["gfm", "commonmark"]) {
      for (const word of ["callout-note", "panel-tabset"]) {
        expect(names(doc("sg", word, from)), `${from} ${word}`).toEqual(["Hsg", "Ksg", "Aftersg"]);
      }
    }
  });
});

// The long word that STARTS like a name the readers know: `callout-` and a long tail is no callout type, `panel-tabset-` and a long tail is no tabset, and the document keeps its headings (commonmark_x, where the readers matter).
describe("Session 338 — a long word that starts like a known one is a plain div", () => {
  it.each([
    ["callout- and 4,300,000 letters", `callout-${"a".repeat(LONG)}`],
    ["callout- and 4,299,999 letters then one above U+00FF", `callout-${"a".repeat(LONG - 1)}${CJK}`],
    ["panel-tabset- and 4,300,000 letters", `panel-tabset-${"a".repeat(LONG)}`],
    ["panel-tabset- and 4,299,999 letters then one above U+00FF", `panel-tabset-${"a".repeat(LONG - 1)}${CJK}`],
    ["dashes and underscores in the word, 4,300,000 characters then one above U+00FF", "a-_".repeat(Math.floor(LONG / 3)).padEnd(LONG, "-") + CJK],
  ])("%s", (_what, word) => {
    const { result, ms } = timed(() => names(doc("lw", word, "commonmark_x")));
    expect(result).toEqual(["Hlw", "Klw", "Afterlw"]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);
});

// The hiding, cured one site at a time: each legacy reader on its own, with the arguments `computeRegions` passes (the word, and for the callout reader the reader's dialect flag).
describe("Session 338 — legacyDivCalloutTitleSlot on its own", () => {
  it.each(FORMS.map((f) => [f.name, f] as const))("a word of 4,300,000 letters, %s, is no callout, under either dialect flag", (_name, form) => {
    const word = form.word();
    const { result, ms } = timed(() => [legacyDivCalloutTitleSlot(word, true), legacyDivCalloutTitleSlot(word, false)]);
    expect(result).toEqual([false, false]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("a short word is read as before: `callout` and `callout-note` are callouts, the rest of the types too, and `callout-bogus` is not", () => {
    expect(["callout", "callout-note", "callout-tip", "callout-warning", "callout-important", "callout-caution"].map((w) => legacyDivCalloutTitleSlot(w, true))).toEqual([true, true, true, true, true, true]);
    expect(["callout-bogus", "callouts", "panel-tabset", "abcd", "callout-", "callout_note", "calloutnote", "Callout-Note"].map((w) => legacyDivCalloutTitleSlot(w, false))).toEqual([false, false, false, false, false, false, false, false]);
  });

  // The review of Session 338: nothing pinned the case of the bare word, and a lower-cased spelling lifts a heading that quarto keeps (the forbidden direction). `Callout` is a class of its own, and so are the others.
  it("the spelling is case-sensitive: `Callout`, `CALLOUT`, `Callout-note`, `callout-NOTE` and `CALLOUT-NOTE` are no callout, under either dialect flag", () => {
    const words = ["Callout", "CALLOUT", "Callout-note", "callout-NOTE", "CALLOUT-NOTE"];
    expect(words.map((w) => legacyDivCalloutTitleSlot(w, false))).toEqual([false, false, false, false, false]);
    expect(words.map((w) => legacyDivCalloutTitleSlot(w, true))).toEqual([false, false, false, false, false]);
  });

  // A spec that is no bare word goes on to the attribute-block reading, which the word test must not take for its own: `{` is no member of the class.
  it("an attribute block is still read as one: a callout class is a callout, a title or a tabset written first is not", () => {
    expect(["{.callout-note}", "{.callout}", "{.callout-tip #a}", "{.callout-note .panel-tabset}"].map((a) => legacyDivCalloutTitleSlot(a, false))).toEqual([true, true, true, true]);
    expect(["{.callout-note title=\"x\"}", "{.panel-tabset .callout-note}", "{.callout-bogus}", "{.note}", "{}"].map((a) => legacyDivCalloutTitleSlot(a, false))).toEqual([false, false, false, false, false]);
    expect([legacyDivCalloutTitleSlot("", true), legacyDivCalloutTitleSlot("callout-note ", true), legacyDivCalloutTitleSlot(" callout-note", true)]).toEqual([false, false, false]);
  });
});

describe("Session 338 — legacyDivPanelTabset on its own", () => {
  it.each(FORMS.map((f) => [f.name, f] as const))("a word of 4,300,000 letters, %s, is no tabset", (_name, form) => {
    const word = form.word();
    const { result, ms } = timed(() => legacyDivPanelTabset(word));
    expect(result).toBe(false);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("a short word is read as before: `panel-tabset` is a tabset, `panel-tabsets` and `Panel-Tabset` are not", () => {
    expect([legacyDivPanelTabset("panel-tabset"), legacyDivPanelTabset("panel-tabsets"), legacyDivPanelTabset("Panel-Tabset"), legacyDivPanelTabset("callout-note"), legacyDivPanelTabset("")]).toEqual([true, false, false, false, false]);
    expect([legacyDivPanelTabset("panel_tabset"), legacyDivPanelTabset("panel-tabset-"), legacyDivPanelTabset("xpanel-tabset"), legacyDivPanelTabset("panel-tabset "), legacyDivPanelTabset(" panel-tabset")]).toEqual([false, false, false, false, false]);
  });

  it("an attribute block is still read as one: a tabset class is a tabset, a callout written first is not", () => {
    expect(["{.panel-tabset}", "{.panel-tabset #a}", "{.panel-tabset .callout-note}", "{.foo .panel-tabset}"].map((a) => legacyDivPanelTabset(a))).toEqual([true, true, true, true]);
    expect(["{.callout-note .panel-tabset}", "{.panel-tabsets}", "{.tabset}", "{data-x=\".panel-tabset\"}", "{}"].map((a) => legacyDivPanelTabset(a))).toEqual([false, false, false, false, false]);
  });
});

// What the rows above are built on, pinned: a size under the first throw, a form that is not the form it names, or a reader that is no CommonMark-family reader would leave every document row green on the parent.
describe("Session 338 — the sizes, forms and readers of the document rows", () => {
  it("keeps a size past the first throw (4,194,288 letters), the limit, the three readers and the three forms with their widths", () => {
    expect(LONG).toBe(4_300_000);
    expect(LONG).toBeGreaterThan(4_194_288);
    expect(LIMIT_MS).toBe(15_000);
    expect(READERS.map((r) => [r.from, r.key])).toEqual([["gfm", "g"], ["commonmark", "c"], ["commonmark_x", "x"]]);
    expect(FORMS.map((f) => f.key)).toEqual(["1", "2", "3"]);
    const widths = FORMS.map((form) => {
      const word = form.word();
      let above = 0;
      for (let i = 0; i < word.length; i++) {
        if (word.charCodeAt(i) > 0xff) above++;
      }
      return [word.length, above];
    });
    expect(widths).toEqual([[LONG, 0], [LONG, 1], [LONG, LONG]]);
    expect(doc("p", "w", "gfm")).toBe("---\nfrom: gfm\n---\n\n::: w\n\n# Hp\n\n## Kp\n\n:::\n\n![x](y){#fig-p}\n\n```{r}\n#| label: tbl-cp\n1\n```\n\n## Afterp\n");
  });
});
