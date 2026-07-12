# %%
# An ordinary Python script. It has percent CODE cells, but no leading
# `# %% [markdown]` / `# %% [raw]` cell, so Quarto cannot determine an execution
# engine for it ("Can't determine execution engine") and it is NOT a render
# script. This is the reject-path fixture for `quarto.previewScript`.
#
# The unquoted `data[raw]` subscript below is deliberate: it puts the literal
# substring `raw]` in the file. Quarto's own percent regex is UNANCHORED on that
# alternation branch, so the CLI's own detector calls this file a render script
# (a real bug — see src/core/render-script.ts). Ours must not. That makes this
# fixture the integration-level twin of the unit DISCRIMINATOR tests.
data = {"raw": [1, 2, 3]}
raw = "raw"
arr = data[raw]

# %%
print(arr)
