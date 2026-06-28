# Quarto (MIT)

An **MIT-licensed** Visual Studio Code extension that reimplements much of the
authoring experience of Posit's Quarto extension — render, live preview, `.qmd`
language support, code-cell execution, and editor intelligence — built
independently on MIT upstreams and the MIT Quarto CLI (shelled out at runtime).

> Status: **early development.** Highlighting (`.qmd` grammar), **Render**, and
> live **Preview** work today; code-cell execution and editor intelligence
> (outline, completion) are still to come.

## Requirements

- The [Quarto CLI](https://quarto.org) (≥ 1.7) installed and on your `PATH`, or
  pointed to by the `quarto.path` setting.

## Commands

| Command | Description |
|---|---|
| **Quarto: Verify Installation** | Resolves the Quarto CLI and reports its version, or an actionable error if it cannot be found. |
| **Quarto: Render** | Runs `quarto render` on the active `.qmd`, streaming output to a "Quarto Render" channel; offers to open the produced artifact, or surfaces the error verbatim on failure. |
| **Quarto: Preview** | Runs `quarto preview` on the active `.qmd` and embeds the live, auto-reloading preview in a pane beside the editor. The preview server is shut down automatically when you close the pane. |

## Settings

| Setting | Default | Description |
|---|---|---|
| `quarto.path` | `""` | Absolute path to the `quarto` executable. When empty, `quarto` is resolved from the `PATH`. |

## License

Licensed under the MIT License (see [`LICENSE`](LICENSE)). This extension
is an independent reimplementation; it does not fork or copy Posit's
AGPL-licensed Quarto extension.
