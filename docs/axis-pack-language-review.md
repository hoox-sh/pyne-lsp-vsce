# AXIS pack — PYNE language surface review

**Date:** 2026-11-09  
**Repo:** `pyne-lsp-vsce` (`hoox-sh.pyne`)  
**Compared to:** `axis-ide-vsce/docs/competitive/pyneide-vs-axis.md` pack-level Match (items 13–15) and P1-5  
**Constraint:** no chart and no debugger in PYNE; AXIS owns chart run.

Sources: this checkout’s `package.json` / `src/*.ts` / `FEATURES.md`; AXIS working-tree `package.json` and `src/host/open-chart.ts` (`PINE_LANGUAGE_ID = 'pinescript'`); competitive doc pack Match + P1-5.

---

## Verdict

Language coverage for the AXIS pack is **Match** on Pine LS, Convert to v6, and `.pyne` / `.pine` association **if** buffers stay on language id `pinescript`. That is now enforced here. Remaining pack gap that is still **P1** is Series/`na` diagnostics vs Pyne Edge (server-side, not this client). PYNE must not grow a second chart; `/run` is a one-bar smoke.

---

## What changed in this pass

### Language ids (AXIS `when` can match)

AXIS menus and `Ctrl/Cmd+Enter` use `editorLangId == pinescript` / `resourceLangId == pinescript` only (`axis-ide-vsce/package.json`). Runtime also accepts path suffixes via `isPineFilePath` (`src/host/open-chart.ts`).

PYNE already mapped `.pyne` / `.pine` / `.pinev5` / `.pinev6` / `.pinescript` to **one** id `pinescript`. That is the correct pack contract. Splitting `.pyne` onto a PyneIDE-style `pyne` id would **break** AXIS title-bar Run/Open Chart.

This pass:

- Kept a **single** contributed language id: `pinescript`.
- Aliases now include `pine` and `pyne` (display / picker names, not extra ids).
- Added `.psc` (PyneIDE Pine suffix) and `firstLine` `//@version=`.
- `files.associations` defaults lock those suffixes to `pinescript`.
- On open, remaps incoming `pine` / `pyne` (and suffix mismatches) to `pinescript` so AXIS `when` fires.
- LSP `documentSelector` still accepts `pine` / `pyne` until remap lands.
- `onLanguage:pinescript` is explicit in `activationEvents`.
- Explorer nesting: `*.pyne` / `*.pine` nest sibling `*.axis.json` and `*.toml`.

AXIS follow-on (not this repo; P0-10 in the competitive doc): optional belt `resourceExtname == .pine || resourceExtname == .pyne` is redundant while PYNE is installed, but harmless.

### Convert to v6 UX

Pack Match item 14. Command id unchanged (`pynescript.convertToV6`).

- Progress notification while LSP or Python rewrite runs.
- Python fallback is `execFile` (async), not a sync UI freeze.
- Toast uses `from_version` when present (`Converted Pine v5 → v6`) and mentions Undo.
- `enablement` / context menu: `editorLangId == pinescript` (not readonly).
- Still local — no source upload (Exceed vs PyneComp).

### `/run` smoke vs AXIS chart run

AXIS `axis.runScript` posts **history bars** and paints the chart. PYNE `pynescript.runOnPro` posted **one synthetic bar** and toasted “script ran successfully”, which read like a second Run.

This pass:

- Title: **Smoke /run (one bar)**. Description says it is not a chart.
- Palette `when`: `editorLangId == pinescript` (no longer hidden behind `pynescript.pro.enabled`, which made the command dead for the default local backend).
- Hosted `pynescript.online` still requires `pro.enabled` + API key.
- Success toast: “no chart”; offers **AXIS: Run Script** when `hoox-sh.axis-ide` is present.
- Not added to `editor/title` or `editor/context` (AXIS already owns those).
- No webview, no custom editor, no debugger.

`PYNE: Test Backend Connection` stays as `GET /health`. `Start Backend` is hidden when `backend.useHosted` is on.

### Dead / noisy commands

Kept the feature toggles (they flip live settings). Not dead.

Tightened:

| Command | Change |
| --- | --- |
| `pynescript.runOnPro` | Retitled smoke; local path no longer gated on Pro |
| `pynescript.startBackend` | Hidden when hosted |
| `pynescript.formatDocument` / `convertToV6` / `openDocumentLink` | `enablement`: pinescript editor |
| Chart / DAP | Still absent (correct) |

### Workspace trust

Declared `untrustedWorkspaces` / `virtualWorkspaces` **false** (PYNE starts a local Python language server). Analog to competitive P1-4, on this extension.

---

## Pack-level Match (from competitive doc)

| Item | PyneIDE | PYNE after this pass | Status |
| --- | --- | --- | --- |
| 13. Pine LS diagnostics / completion / hover / signature | Built-in LS | `pyne-lsp` via `hoox-pyne[lsp]` | **Match** (quality vs their LS still Unknown without a side-by-side install) |
| 14. Convert to v6 | `pyneide.convertToV6`, free | `pynescript.convertToV6`, local, undo toast | **Match** |
| 15. `.pyne` / `.pine` association | `pine` + `pyne` ids | **one** id `pinescript` for both (AXIS `when`) | **Match** for the pack; **not** PyneIDE’s Python `@pyne` mode |

HOOX `.pyne` files are **Pine source**, not PyneIDE’s Python/`@pyne` dialect. Do not register language id `pyne` for `.pyne`.

---

## Remaining P1 — Series/`na` vs Pyne Edge

Competitive **P1-5** (owner: PYNE): *Series/`na` diagnostics parity vs Pyne Edge (gap analysis)*.

Pyne Edge (PyneIDE 0.14.1, Confirmed in their README / VSIX): bundled pyright + Pyne checker + **Pyne Edge** linter for **Series / `na` / persistent** on **Pyne (Python)** files; can take over from Pylance.

This client (`hoox-sh.pyne`):

| Capability | Here | vs Edge |
| --- | --- | --- |
| Token highlight for `na`, `series` | TextMate `constant.language.na` / `variable.language.series` | Highlight only, not a type checker |
| Parse + lint diagnostics | `pyne-lsp` pull/push | Pine parser/linter, not Edge |
| `pynescript.diagnostics.semantic` (opt-in) | Unknown fields/methods, enum members, user-function arity | **Not** Series/`na` propagation |
| Persistent (`var` / `varip`) analysis | Not documented in FEATURES / client | Missing |
| `na` arithmetic / `nz()` suggestions | Not in this repo | Missing |
| Bundled pyright | **No** (extension ships no server) | Edge’s Python path |
| Python `@pyne` / language id `pyne` | **Out of scope** (would collide with AXIS) | Different product surface |

**Gap list (P1-5, still open — server `hoox-sh/pyne`, not more VS Code chrome):**

1. Series qualifier errors (`simple` used as `series`, illegal `series` in `const` context).
2. `na` propagation and missing `nz()` / `fixnan` on values that can be `na`.
3. `var` / `varip` persistence vs reassignment mistakes.
4. History-referencing (`close[1]`) type vs scalar.
5. Written fixtures + issues in `hoox-sh/pyne` comparing Edge findings on a shared sample.

Until the language server emits those diagnostics, this extension can only display them. Turning on `diagnostics.semantic` is **not** Edge parity.

**P1-6** (local Pine→PYNE compile without cloud) is also still open: Convert to v6 is local; compiling Pine to Python is not in this client. Chart run of `.pine` without leaving the machine is an AXIS + engine card.

Pro API key is SecretStorage only (`pynescript.secrets.setProKey` / `clearProKey`). There is no `pynescript.pro.apiKey` setting.

---

## What we did not do

- No chart webview, no DAP, no `pyne` debug type (forbidden / collision with PyneIDE).
- No marketplace / vsce publish (Ask first).
- No edits in `axis-ide-vsce` (read-only for this card).
- No PyneIDE install into VSCodium.

---

## Proof

- Artifact: `docs/axis-pack-language-review.md` (this file)
- Verify: `./scripts/verify.sh`
