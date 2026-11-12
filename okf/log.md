# Bundle Update Log

## 2026-11-12

- LSP 3.18 / VS Code 1.146 review (`docs/lsp-feature-gaps-2026.md`) and the
  first integrations: declaration, type definition, call hierarchy, code lens,
  inline completion (server); PYNE MCP registration + code-lens/inline gates
  (extension). VS Code engine floor is now 1.102.
- Review follow-ups: lazy LSP start (no Python server in non-Pine workspaces),
  validated `pyne-mcp` discovery, code-lens refresh on settings changes,
  comment/string guard for inline completion.

## 2026-11-10

- Format gate uses the initialize legend (`series`/`simple` tail) or
  `serverInfo.version` >= 0.6.35. 0.6.34 stays comment-free only.

- Editor pass: severity remap, single diagnostic collection, link and lookahead
  positions, inlay toggle, grammar operator order, AXIS Day, status-bar
  recovery. See `docs/editor-pass.md`.

## 2026-11-09

- AXIS pack language surface: canonical id `pinescript`, Convert to v6 UX,
  `/run` smoke vs AXIS chart run. See `docs/axis-pack-language-review.md`.

## 2026-11-07

- **Initialized**: Created the OpenOrchestrate setup, project scaffold, hooks,
  and knowledge bundle.
