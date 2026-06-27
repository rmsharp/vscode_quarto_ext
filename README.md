# Quarto (MIT)

An **MIT-licensed** Visual Studio Code extension that reimplements much of the
authoring experience of Posit's Quarto extension — render, live preview, `.qmd`
language support, code-cell execution, and editor intelligence — built
independently on MIT upstreams and the MIT Quarto CLI (shelled out at runtime).

> Status: **early development.** This is Phase 1 (the walking skeleton). The only
> command so far is **Quarto: Verify Installation**.

## Requirements

- The [Quarto CLI](https://quarto.org) (≥ 1.7) installed and on your `PATH`, or
  pointed to by the `quarto.path` setting.

## Commands

| Command | Description |
|---|---|
| **Quarto: Verify Installation** | Resolves the Quarto CLI and reports its version, or an actionable error if it cannot be found. |

## Settings

| Setting | Default | Description |
|---|---|---|
| `quarto.path` | `""` | Absolute path to the `quarto` executable. When empty, `quarto` is resolved from the `PATH`. |

## License

[MIT](./LICENSE). This extension is an independent reimplementation; it does not
fork or copy Posit's AGPL-licensed Quarto extension.
