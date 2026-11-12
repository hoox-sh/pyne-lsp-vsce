# Changelog

All notable changes to pyne are documented here.

## [Unreleased]

### Changed

- **Quieter, safer logging.** The output channel is timestamped, deduplicates repeated lines, caps at 5000 lines, and redacts HOOX/vendor tokens, bearer headers, URL credentials, and key/value secrets. Startup settings and launch probes moved to `debug`, so `info` stays a lifecycle log and activation no longer re-runs Python discovery.
- **Formatting follows the advertised server.** Full format (comments kept) turns on when `initialize` reports a legend ending in `series`, `simple`, or `serverInfo.version` is at least 0.6.35. hoox-pyne 0.6.34 stays comment-free only.
- **Semantic diagnostics** document `S003` (value too weak for its declared type) and `S004` (bare `na` with no contextual type). Remap both with a severity prefix of `S`.
- **VS Code engine floor is 1.102** (`@types/vscode` 1.102) for the MCP provider API. Activation now includes `onStartupFinished` so agent mode can discover the MCP server before a Pine file is open; the language server itself starts only when a Pine document is open or the workspace contains Pine files, so non-Pine workspaces no longer spawn `pyne-lsp` (or show the install prompt) at startup.
- **Safer MCP discovery.** The `pyne-mcp` fallback now validates that its shebang interpreter can import `pynescript.mcp`, ignoring stale console scripts; the provider registers even when `pynescript.mcp.enabled` is false so toggling it on does not require a reload.

### Fixed

- **Diagnostic severity overrides** use the VS Code scale (Error 0 … Hint 3). They were shifted by one, and Hint was not a real severity.
- **Pull and push diagnostics** no longer both render. `pyne-lsp` serves `textDocument/diagnostic` and also publishes; the client keeps one collection and still applies severity overrides.
- **Open Document Link** matches the column on the current line. It missed every URL below line 1.
- **Lookahead warnings** keep their line after a `//` comment or a string. Comments used to be deleted before the scan, which shifted the underline.
- **Inlay hints toggle** turns on `pynescript.inlayHints.parameters` together with the editor decoration. The command used to flip only the decoration, so the server sent nothing.
- **`==`, `!=`, `<=`, `>=`, and `<<` / `>>`** are comparison and shift tokens. A bare `=` was matched first, so `==` highlighted as two assignments.
- **Indent** after `indicator` / `strategy` / `library` no longer pushes the rest of the file in one level.
- **Snippets** use `minval` and `label.style_label_up`. `min=` and `label.style.label_up` are not Pine.

### Added

- **PYNE MCP server registration.** The extension registers `pyne-mcp` with VS Code / Copilot agent mode via `contributes.mcpServerDefinitionProviders` + `lm.registerMcpServerDefinitionProvider`, so agent sessions get `pyne_check`, `pyne_lint`, `pyne_compile`, `pyne_run`, `pyne_convert`, and the rest without a manual `.mcp.json`. Discovery prefers a Python that can import `pynescript.mcp`, then `pyne-mcp` on `PATH`; `pynescript.mcp.*` settings override.
- **Code lenses and inline completion settings.** `pynescript.codeLens.enabled` (default on) shows **Convert to v6** / **Smoke /run** above the script declaration; `pynescript.inlineCompletion.enabled` (default off) gates the new LSP 3.18 ghost text. Both are mirrored to the server and gated client-side.
- **AXIS Day**, a light HOOX theme whose Pine token colors stay readable on paper. Dark themes no longer inject the void palette on top of it.
- **PYNE: Language Server Status** — the status item opens a menu with output, a troubleshooting report, restart, and the resolved launch command; a failed start offers install, retry, output, and report actions.
- **PYNE: Copy Troubleshooting Report** — copies a redacted report with the resolved launch command, `pyne-lsp` / `pynescript-lsp` / `pyne-mcp` paths, Python + `hoox-pyne` versions, client state, last error, and settings.
- **`pynescript.logging.level`** (`off` / `error` / `warn` / `info` / `debug` / `trace`, default `info`) and **`pynescript.trace.server`** (`off` / `messages` / `compact` / `verbose`, default `off`). Trace applies live without a restart.
- Changing `pynescript.install.python` restarts the client.
- Snippets for `var`, `varip`, `method`, `import`, `alertcondition`, `bgcolor`, and a library annotation block.
- Grammar: `font` / `earnings` / `dividends` / `splits`, `.psc`, series names (`year`, `time`, …) as series rather than functions, `na` as a literal, no `#` line comments.

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
