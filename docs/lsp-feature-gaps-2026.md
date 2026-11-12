# LSP / VS Code feature review — November 2026

Status: research note. No behavior changed.

> **Update 2026-11-12:** the recommended P0/P1/P2 items are implemented:
> declaration, type definition, call hierarchy, code lens, and inline completion
> in `pynescript`; MCP server registration plus the code-lens/inline-completion
> gates in this extension. See the "Implemented in this pass" section below.

Scope: what the LSP and VS Code now offer, what `pyne-lsp` + this extension
already use, and which missing features are worth integrating.

## Versions checked

| Component | Version | Notes |
| --- | --- | --- |
| LSP specification | **3.18 (current)** | 3.18.0 published 2026-06-04; 3.19 is an empty draft |
| VS Code | **1.146** (2026-11-11) | AI/agents release; language APIs stable |
| `pyne-lsp` runtime | pygls **2.1.1**, lsprotocol **2025.0.0** | supports the 3.18 feature set |
| VS Code client | vscode-languageclient **11.0.0**, protocol **3.18.5** | supports inline completion, snippet edits, ranges formatting |
| Extension types | `@types/vscode` **1.102.0** (`engines.vscode ^1.102.0`) | MCP provider + LM tool APIs available |

## What is new upstream

### LSP 3.18 (2026-06-04)

- Inline completions (`textDocument/inlineCompletion`)
- Dynamic text document content (`workspace/textDocumentContent`)
- Folding range refresh (`workspace/foldingRange/refresh`)
- Format multiple ranges at once (`textDocument/rangesFormatting`)
- Snippets in workspace edits and text document edits (`SnippetTextEdit`)
- Relative patterns in document filters
- Code action kind documentation
- `Command` tooltips
- Workspace edit metadata
- `Diagnostic.message` as `MarkupContent`
- `CompletionList.applyKind`, nullable `SignatureHelp.activeParameter`
- Code lens resolve-property enumeration

### VS Code 1.146

The release is dominated by agents/chat. The relevant extension APIs:

- **Language Model Tools** (`contributes.languageModelTools` + `lm.registerTool`)
- **MCP server registration** (`contributes.mcpServerDefinitionProviders` +
  `lm.registerMcpServerDefinitionProvider`)
- Document paste edit providers, inline completions, call/type hierarchy
- Agents-window extension support (`extensions.supportAgentsWindow` override)

## Current surface

`pyne-lsp` registers: completion (+resolve), hover, signature help, definition,
references, document highlight, linked editing, prepare/rename, document and
workspace symbols, document/range/on-type formatting, folding, selection range,
document color, document link (+resolve), code actions, execute command, inlay
hints, semantic tokens (full + range), diagnostics (push + pull, with refresh).

The extension adds: themes, grammar, snippets, Convert to v6, static lookahead
grep, smoke `/run`, backend commands, SecretStorage Pro key.

## Gap table

Client support = vscode-languageclient 11 / VS Code 1.146. Effort is relative to
this codebase.

| Feature | LSP method | Client | Server | Value | Effort |
| --- | --- | --- | --- | --- | --- |
| **MCP tools** | n/a (VS Code API) | ✅ | n/a | **Very high** — `pyne-mcp` already ships ~33 tools | S |
| **LM tools** | n/a (VS Code API) | ✅ | n/a | High — editor-aware lint/convert/run in agent mode | S–M |
| **Type definition** | `textDocument/typeDefinition` | ✅ | ❌ | High — UDT variable → `type Foo` | S |
| **Declaration** | `textDocument/declaration` | ✅ | ❌ | Medium — same target as definition for Pine | S |
| **Call hierarchy** | `prepareCallHierarchy`, `callHierarchy/*` | ✅ | ❌ | High — user functions in long strategies | M |
| **Code lens** | `textDocument/codeLens` (+resolve) | ✅ | ❌ | Medium — "Smoke run", "Convert to v6", "Docs" | M |
| **Inline completion** | `textDocument/inlineCompletion` | ✅ | ❌ | Medium — deterministic Pine ghost text | M |
| **Semantic tokens delta** | `semanticTokens/full/delta` | ✅ | ❌ | Medium — large-file typing cost | M |
| **Code action resolve** | `codeAction/resolve` | ✅ | ❌ | Low–medium — lazy actions | S |
| **Workspace symbol resolve** | `workspaceSymbol/resolve` | ✅ | ❌ | Low — richer result details | S |
| **File rename** | `workspace/willRenameFiles` | ✅ | ❌ | Medium — rewrite Pine `import` paths | M |
| **Folding refresh** | `workspace/foldingRange/refresh` | ✅ | ❌ | Low — settings-driven folds | S |
| **Snippet text edits** | `SnippetTextEdit` in actions | ✅ | ❌ | Low — cursor placement in fixes | S |
| **Paste edit** | `registerDocumentPasteEditProvider` | ✅ (1.146) | n/a | Medium — convert pasted v4/v5 to v6 | S–M |
| **Type hierarchy** | `typeHierarchy/*` | ✅ | ❌ | None — Pine has no inheritance | — |
| **Implementation** | `textDocument/implementation` | ✅ | ❌ | None — no interfaces | — |
| **Inline values / moniker** | `inlineValue`, `moniker` | ✅ | ❌ | None — no debugger / no cross-language index | — |
| **Ranges formatting** | `textDocument/rangesFormatting` | ✅ | ❌ | None — **VS Code has no API for it** | — |
| **Diagnostic Markdown** | `Diagnostic.message: MarkupContent` | ❌ | n/a | None — client sets `markupMessageSupport=false` | — |
| **`CompletionList.applyKind`** | 3.18 | ✅ | ❌ | None — lsprotocol 2025 lacks the type | — |

## Implemented in this pass

| Item | Where | Gate |
| --- | --- | --- |
| Declaration | `pynescript` `features/definitions.py` | always on |
| Type definition (UDT) | `pynescript` `features/definitions.py` | always on |
| Call hierarchy | `pynescript` `features/call_hierarchy.py` | always on |
| Code lens (Convert to v6 / Smoke) | `pynescript` `features/code_lens.py` | `pynescript.codeLens.enabled` |
| Inline completion (LSP 3.18) | `pynescript` `features/inline_completion.py` | `pynescript.inlineCompletion.enabled` (off) |
| MCP server registration | `pyne-lsp-vsce` `src/mcp.ts` | `pynescript.mcp.enabled` |

Tests: `pynescript/tests/test_lsp_navigation_extras.py`,
`tests/test_langserver_server_coverage.py::TestNewLanguageFeatures`, and the
extension `manifest.test.ts` MCP/settings block.

## Recommended order

### P0 — MCP server registration (smallest change, biggest reach)

`pynescript` already ships `pyne-mcp` (stdio by default, ~33 tools:
`pyne_check`, `pyne_lint`, `pyne_compile`, `pyne_run`, `pyne_convert`,
`pyne_hover`, `pyne_complete`, `pyne_runner_*`, …).

Add to this extension:

1. `contributes.mcpServerDefinitionProviders` in `package.json`.
2. `lm.registerMcpServerDefinitionProvider` on activation, returning a
   `vscode.McpStdioServerDefinition` that runs the same Python as the LSP
   (`resolvePythonForInstall()` / `pynescript.lsp.python`) with
   `-m pynescript.mcp`.
3. Bump `engines.vscode` and `@types/vscode` to a version with the API
   (1.146 is current stable).

Result: Copilot/agent mode gets PYNE compile/lint/run tools with no manual
`.mcp.json`, and the same server works in other MCP clients.

### P1 — cheap language-server wins

1. **`textDocument/typeDefinition`** — resolve the variable's inferred/declared
   UDT and return the `type` node. `analysis.SymbolIndex` already tracks
   `types` / `udt_fields`.
2. **`textDocument/declaration`** — delegate to `handle_definition` (Pine does
   not distinguish declaration from definition).
3. **Call hierarchy** — `analysis` already has `functions`, `scopes`, and
   `occurrences`; build incoming/outgoing calls from `Call` nodes.
4. **Code lens** — one lens above `indicator()` / `strategy()`:
   `Convert to v6` (command `pynescript.convertToV6`) and optionally
   `Smoke /run` (command `pynescript.runOnPro`, Pro only). The client already
   registers both commands.

### P2 — differentiation

1. **Inline completions** (LSP 3.18). Deterministic, setting-gated ghost text:
   complete `strategy.entry(` arguments, `ta.sma(close, ` → `14)`, or a
   `//@version=6` header. Keep it off by default; avoid model calls.
2. **File rename** — `workspace/willRenameFiles` rewrites Pine `import` paths.
   `SymbolIndex.imports` already exists.
3. **Semantic tokens delta** — send edits instead of a full token array on each
   keystroke; matters for multi-thousand-line strategies.
4. **Paste edit** — if pasted text is Pine v4/v5, offer "Convert pasted code to
   v6" using the existing convert pipeline.

### Explicitly skip

- Type hierarchy, implementation, moniker, inline values: no Pine semantics or
  no debugger to attach to.
- `textDocument/rangesFormatting`: the VS Code API does not expose multiple
  ranges (verified against `@types/vscode` 1.146).
- Diagnostic Markdown: `vscode-languageclient` hard-codes
  `markupMessageSupport = false`.
- `CompletionList.applyKind`: not in lsprotocol 2025.0.0 yet.

## Constraints

- `engines.vscode ^1.102.0` provides `lm.registerMcpServerDefinitionProvider`,
  `lm.registerTool`, and `registerDocumentPasteEditProvider`. Raising it further
  is only needed for APIs added after 1.102.
- LSP features are server-only: once `pyne-lsp` registers the handler, pygls
  advertises the capability and the client registers the provider. No extension
  change is needed for declaration/typeDefinition/callHierarchy/codeLens/
  inlineCompletion.
- Inline completion must be registered with `options=True`; pygls defaults the
  capability to `None` and would otherwise omit it.

## Sources

- LSP 3.18 spec and changelog: <https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/>
- LSP 3.19 draft: <https://microsoft.github.io/language-server-protocol/specifications/lsp/3.19/specification/>
- VS Code 1.146 release notes: <https://code.visualstudio.com/updates>
- Programmatic language features: <https://code.visualstudio.com/api/language-extensions/programmatic-language-features>
- AI extensibility overview: <https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview>
- MCP in VS Code: <https://code.visualstudio.com/api/extension-guides/ai/mcp>
- Language Model Tools: <https://code.visualstudio.com/api/extension-guides/ai/tools>
