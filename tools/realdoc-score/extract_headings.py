"""Extract the BODY heading list from a quarto HTML render — the real-document measure's
ground-truth reader (Session 251; corrected Session 265 I1; moved here from `scratchpad/s265/
extract_headings_v2.py` and adopted as the standing instrument, Session 268).

⚠ **Corpus documents are named by ORDINAL only** — the 1-based line of the ordinals file this
project's measure is run against (`REALDOC_ORDINALS`, see `README.md`). The corpus is personal and
is never committed; a tracked file that spelled a document's path would leak it (Learning #548).


⚠ WHY THIS IS NOT render250.sh's H_DIRECT COLUMN.

The inherited renderer's scoring column matches `<hN ...>text</hN>` where `text` contains no
`<` at all.  That is sound for the probe corpora it was built for, whose heading text is
always a bare literal like `ATX Below`.  It is UNSOUND for authored documents, where heading
text routinely contains inline markup:

    ## A concrete `SKILL.md`   ->  <h2>A concrete <code>SKILL.md</code></h2>

That contains `<`, so H_DIRECT reports NO HEADING for it — the same direction (heading-losing
looks safe) as the four extractor defects already documented in render250.sh's header.  This
is the fifth of that family and it only appears once the corpus stops being synthetic.
Measured firsthand on corpus ordinal 1: H_DIRECT drops `A concrete SKILL.md` and ALSO invents
two headings from the page chrome.

So: a real HTML parser, no regex pairing at all.

⚠ SKIPPING PAGE CHROME IS THE OTHER HALF, AND IT IS NOT OPTIONAL.  A default quarto HTML
render surrounds the body with navigation furniture that contains REAL h-tags which
correspond to no source line:

  <nav id="TOC">                       -> <h2 id="toc-title">Table of contents</h2>
  <div class="quarto-alternate-formats"> -> <h2>Other Formats</h2>      (margin sidebar)
  <header id="title-block-header">     -> <h1 class="title">…</h1>
  <section class="footnotes">          -> <h2>Footnotes</h2>

Every one of those inflates quarto's list and therefore reads as a heading the MODEL lost.
On this session's first pass, `Other Formats` alone accounted for a large share of the
apparent "model reports fewer headings" divergences.  They are skipped by container id/class
rather than by scoping to <main>, because <main>-scoping is itself unsound for any document
containing a raw stray closer (render250.sh's third documented extractor defect).

⚠ DO NOT "STRIP MINTED SECTIONS FROM THE TAIL" INSTEAD.  A document whose source really does
carry `## References` renders a real heading there, and blind tail-stripping deletes it —
manufacturing a divergence in the opposite direction.  Measured on corpus ordinal 28.
"""

import html.parser
import re
import sys

SKIP_TAGS = {"nav", "header", "aside", "footer"}

SKIP_CLASS = re.compile(
    r"\b("
    r"quarto-alternate-formats|margin-sidebar|quarto-sidebar|"
    r"quarto-title-block|title-block-header|"
    r"footnotes-end-of-document|"          # quarto's GENERATED endnotes block only
    r"quarto-secondary-nav|nav-page|toc-actions"
    r")\b"
)
# ⚠ Exact ids only, and NOT a bare `footnotes`/`toc`.  A document whose own source says
# `## Footnotes` renders `<section id="footnotes" class="level2">` — the AUTHOR's heading —
# and a bare-id skip deletes it, manufacturing a lost-heading divergence.  Measured on corpus
# ordinals 308 and 669.  Quarto's own endnotes block is identified by
# `class="footnotes footnotes-end-of-document"` / `role="doc-endnotes"` instead.
SKIP_ID = re.compile(
    r"\A(TOC|quarto-margin-sidebar|quarto-sidebar|title-block-header|quarto-header|quarto-footer|quarto-embedded-source-code-modal|quarto-reuse|quarto-copyright|quarto-citation)\Z"
)
SKIP_ROLE = {"doc-endnotes"}


class HeadingExtractor(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headings = []
        self._skip_stack = []          # tags whose subtree is skipped
        self._open_stack = []          # every open tag, so a skip can be popped correctly
        self._h = None
        self._buf = []
        self._secnum = 0

    # -- skip bookkeeping -------------------------------------------------
    def _skipping(self):
        return bool(self._skip_stack)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        ident = a.get("id") or ""
        void = tag in ("br", "img", "hr", "input", "meta", "link", "source", "col")
        if not void:
            self._open_stack.append(tag)
        if (tag in SKIP_TAGS or SKIP_CLASS.search(cls) or SKIP_ID.match(ident)
                or (a.get("role") or "") in SKIP_ROLE):
            if not void:
                self._skip_stack.append(len(self._open_stack))
            return
        if self._skipping():
            return
        if tag == "span" and "header-section-number" in cls:
            self._secnum += 1
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            if "title" in cls.split():
                self._h = None
                return
            self._h = int(tag[1])
            self._buf = []

    def handle_endtag(self, tag):
        depth = len(self._open_stack)
        if self._open_stack and self._open_stack[-1] == tag:
            self._open_stack.pop()
        elif tag in self._open_stack:
            while self._open_stack and self._open_stack.pop() != tag:
                pass
        if self._skip_stack and self._skip_stack[-1] > len(self._open_stack):
            self._skip_stack.pop()
            return
        if self._skipping():
            return
        if tag == "span" and self._secnum:
            self._secnum -= 1
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self._h is not None:
            text = " ".join("".join(self._buf).split())
            if text:
                self.headings.append((self._h, text))
            self._h = None
            self._buf = []
        _ = depth

    def handle_data(self, data):
        if self._skipping() or self._h is None or self._secnum:
            return
        self._buf.append(data)


def extract(html_text):
    p = HeadingExtractor()
    try:
        p.feed(html_text)
    except Exception:
        pass
    return p.headings


def main():
    for path in sys.argv[1:]:
        hs = extract(open(path, encoding="utf-8", errors="replace").read())
        print(path)
        for lvl, t in hs:
            print(f"  h{lvl}: {t}")


if __name__ == "__main__":
    main()
