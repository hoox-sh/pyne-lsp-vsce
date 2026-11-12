---
type: Reference
title: Architecture
description: The project shape and the OpenOrchestrate team.
tags: [architecture, openorchestrate]
status: stable
---

# Architecture

pyne uses OpenOrchestrate. Languages: JavaScript, TypeScript.

## Runtime surfaces

The VS Code client for PYNE language support on `.pyne` / `.pine` files:
highlighting, diagnostics, completion, hover, signature help, semantic tokens,
formatting, and Convert to v6.

- **Language id:** `pinescript` for `.pyne` / `.pine` / `.psc` (AXIS menus
  match `editorLangId == pinescript`). Do not add a second id for the same
  suffixes.
- **Entry points:** the extension client only. It ships no language server; it
  launches the `pyne-lsp` installed in the user's Python environment from
  `hoox-sh/pyne`.
- **Run vs chart:** `PYNE: Smoke /run (one bar)` is a one-bar `/run` smoke.
  AXIS owns chart run. This extension does not paint a chart or ship a debugger.
- **Themes:** AXIS Void, Hoox Signal, and PYNE Volt are dark. AXIS Day is light.
  The status item runs **PYNE: Language Server Status**.
- **Diagnostics:** `pynescript.logging.level` gates the **PYNE Language Server**
  channel, `pynescript.trace.server` adds LSP traffic, and
  **PYNE: Copy Troubleshooting Report** produces a redacted support payload.
- **Run:** `npm ci && npm run package` builds a VSIX; install with
  `code --install-extension pyne-vscode-*.vsix`.
- **Verify:** `./scripts/verify.sh` runs `npm run lint`, `npm run check`, and
  `npm run test`.

## The team

| Seat | Title | Agent |
| --- | --- | --- |
| Chief | Chief of Staff | `oo-chief` |
| Ops | Head of Operations | `oo-ops` |
| Checker | Quality Gate | `oo-checker` |
| Product | Head of Product | `oo-spec-1` |
| Engineering | Head of Engineering | `oo-spec-2` |
| Misc | General Desk | `oo-misc` |

## The board

The board lives at `.openorchestrate/board.md`. It has five statuses:
Todo, Working, Blocked, Ready for Review, Done. A card moves to Done only with proof.

## Related

- [Development](development.md)
- [Security](security.md)
