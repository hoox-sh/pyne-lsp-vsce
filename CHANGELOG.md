# Changelog

All notable changes to pyne are documented here.

## [Unreleased]

## [0.5.8] — 2026-11-09

### Changed

- **Pro API key is SecretStorage only.** Removed `pynescript.pro.apiKey` from settings. Commands **PYNE: Set Pro API Key** / **Clear Pro API Key**. Leftover plaintext settings migrate once on activate then are wiped.
- **Semantic tokens:** contribute `series` / `simple` types; three themes color them. Format Document / range format respect `pynescript.formatting.enabled`.
- **Inlay hints default off.** `pynescript.inlayHints.parameters` is false; `[pinescript] editor.inlayHints.enabled` is `off`. Toggle still available.
- **Static lookahead grep** (`pyne.lookahead.static`): warning on `lookahead_on` / `request.security` / `calc_on_every_tick=true`. Not a live-taint proof.

### Added

- Initialized the OpenOrchestrate team, hooks, and knowledge bundle.
- AXIS pack language review (`docs/axis-pack-language-review.md`): single
  language id `pinescript` for `.pyne` / `.pine` / `.psc`, file associations,
  sibling `.axis.json` nesting, workspace-trust capabilities.

### Changed

- **Hover / suggest / peek chrome** on AXIS Void, HOOX Signal, and PYNE Volt: accent-tinted hover border and shadow, lifted card fill, inset code-block and kind-chip (`textPreformat`) so signature fences read as AXIS popovers.

- **Convert to Pine v6** shows a progress notification, names the source
  version (v4/v5 → v6), and mentions undo. Python fallback is async.
- **PYNE: Run on Pro** is now **Smoke /run (one bar)** — compile/execute
  smoke only. AXIS owns chart run. Local smoke no longer requires
  `pynescript.pro.enabled`.
- Incoming `pine` / `pyne` language modes on pack suffixes are remapped to
  `pinescript` so AXIS `when` clauses match.
