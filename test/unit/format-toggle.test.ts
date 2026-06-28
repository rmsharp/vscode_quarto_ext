import { describe, expect, it } from "vitest";
import { toggleFormat } from "../../src/core/format-toggle";

describe("toggleFormat", () => {
  it("wraps a non-empty selection and selects the inner content", () => {
    // "foo bar baz", select "bar" (offsets 4..7), bold (**)
    const r = toggleFormat("foo bar baz", 4, 7, "**");
    expect(r.start).toBe(4);
    expect(r.end).toBe(7);
    expect(r.replacement).toBe("**bar**");
    // post-edit text: "foo **bar** baz" — inner "bar" sits at offsets 6..9
    expect(r.selectionStart).toBe(6);
    expect(r.selectionEnd).toBe(9);
  });

  it("unwraps when the markers sit immediately outside the selection", () => {
    // "**bar**", select the inner "bar" (offsets 2..5), bold (**) again
    const r = toggleFormat("**bar**", 2, 5, "**");
    // the outer markers (0..2 and 5..7) are removed: whole 0..7 -> "bar"
    expect(r.start).toBe(0);
    expect(r.end).toBe(7);
    expect(r.replacement).toBe("bar");
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(3);
  });

  it("unwraps when the selection itself includes the markers", () => {
    // "**bar**", select the whole "**bar**" (offsets 0..7), bold (**) again
    const r = toggleFormat("**bar**", 0, 7, "**");
    expect(r.start).toBe(0);
    expect(r.end).toBe(7);
    expect(r.replacement).toBe("bar");
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(3);
  });

  it("wraps the word at a bare cursor (empty selection)", () => {
    // "foo bar baz", cursor at offset 5 (inside "bar" = offsets 4..7), italic (*)
    const r = toggleFormat("foo bar baz", 5, 5, "*");
    expect(r.start).toBe(4);
    expect(r.end).toBe(7);
    expect(r.replacement).toBe("*bar*");
    // post-edit "foo *bar* baz" — inner "bar" at offsets 5..8
    expect(r.selectionStart).toBe(5);
    expect(r.selectionEnd).toBe(8);
  });

  it("does not mistake a `**` bold run for an italic `*` wrap (disambiguation)", () => {
    // "**bar**", cursor inside "bar", italic (*). The adjacent `*` is part of a
    // `**` bold run, NOT a single italic marker — so toggling italic must WRAP
    // (-> bold+italic) rather than strip one `*` and corrupt the bold.
    const r = toggleFormat("**bar**", 3, 3, "*");
    expect(r.start).toBe(2);
    expect(r.end).toBe(5);
    expect(r.replacement).toBe("*bar*");
    // post-edit "***bar***" — inner "bar" at offsets 3..6
    expect(r.selectionStart).toBe(3);
    expect(r.selectionEnd).toBe(6);
  });

  it("does not strip a `**` run when an explicit selection includes it (italic over bold)", () => {
    // Select the whole "**bar**" (0..7) and toggle italic (*): the `**` is bold,
    // not a lone italic marker, so wrap the selection (-> "***bar***").
    const r = toggleFormat("**bar**", 0, 7, "*");
    expect(r.start).toBe(0);
    expect(r.end).toBe(7);
    expect(r.replacement).toBe("***bar***");
    expect(r.selectionStart).toBe(1);
    expect(r.selectionEnd).toBe(8);
  });

  it("unwraps the wrapped word at a bare cursor", () => {
    // "foo *bar* baz", cursor at offset 6 (inside the italicised "bar"), italic
    const r = toggleFormat("foo *bar* baz", 6, 6, "*");
    expect(r.start).toBe(4);
    expect(r.end).toBe(9);
    expect(r.replacement).toBe("bar");
    // post-edit "foo bar baz" — "bar" at offsets 4..7
    expect(r.selectionStart).toBe(4);
    expect(r.selectionEnd).toBe(7);
  });

  it("inserts empty markers with the cursor between them when not in a word", () => {
    // "a  b", cursor between the two spaces (offset 2), bold (**)
    const r = toggleFormat("a  b", 2, 2, "**");
    expect(r.start).toBe(2);
    expect(r.end).toBe(2);
    expect(r.replacement).toBe("****");
    // post-edit "a **** b" — cursor collapsed between the markers at offset 4
    expect(r.selectionStart).toBe(4);
    expect(r.selectionEnd).toBe(4);
  });

  it("expands a bare cursor across non-ASCII (accented) word characters", () => {
    // "café", cursor at offset 2 — bold must wrap the WHOLE word, not split at "é"
    const r = toggleFormat("café", 2, 2, "**");
    expect(r.start).toBe(0);
    expect(r.end).toBe(4);
    expect(r.replacement).toBe("**café**");
    expect(r.selectionStart).toBe(2);
    expect(r.selectionEnd).toBe(6);
  });

  it("does not delete a literal ** when toggling italic with a bare cursor inside it", () => {
    // "a**b", cursor between the two asterisks (offset 2), italic. The `**` is a
    // bold run, not two italic markers wrapping empty content — so DON'T strip it;
    // insert an empty italic pair instead (the insert-empty behavior).
    const r = toggleFormat("a**b", 2, 2, "*");
    expect(r.start).toBe(2);
    expect(r.end).toBe(2);
    expect(r.replacement).toBe("**");
    expect(r.selectionStart).toBe(3);
    expect(r.selectionEnd).toBe(3);
  });

  it("works for the inline-code marker (`)", () => {
    const r = toggleFormat("word", 0, 4, "`");
    expect(r.replacement).toBe("`word`");
    expect(r.selectionStart).toBe(1);
    expect(r.selectionEnd).toBe(5);
  });

  it("round-trips: wrapping then unwrapping restores the original text", () => {
    const wrap = toggleFormat("hello", 0, 5, "**");
    const wrapped =
      "hello".slice(0, wrap.start) + wrap.replacement + "hello".slice(wrap.end);
    expect(wrapped).toBe("**hello**");

    const unwrap = toggleFormat(
      wrapped,
      wrap.selectionStart,
      wrap.selectionEnd,
      "**",
    );
    const restored =
      wrapped.slice(0, unwrap.start) +
      unwrap.replacement +
      wrapped.slice(unwrap.end);
    expect(restored).toBe("hello");
  });
});
