# Editor pass — 2026-11-10

Review of `hoox-sh.pyne` against `pyne-lsp` from `hoox-pyne` 0.6.34, then fixes exercised in VS Code.

## What was broken

| Area | What happened |
| --- | --- |
| Severity overrides | `pynescript.diagnostics.severity` wrote LSP numbers (Error = 1) into VS Code diagnostics (Error = 0). Hint became an invalid severity. |
| Diagnostics | The server both publishes and serves pull diagnostics. The client showed both collections, so every finding appeared twice. Severity overrides only ran on the push path. |
| Open Document Link | The command compared a document offset with a column, so a URL worked only on line 1. |
| Lookahead underlines | `//` comments were deleted before the scan, so a hit below a comment was underlined on the wrong line. Strings were scanned too. |
| Inlay hints | **PYNE: Toggle Inlay Hints** flipped `editor.inlayHints.enabled` and left `pynescript.inlayHints.parameters` false, so the server returned no hints. |
| Grammar | `=` was matched before `==` / `!=` / `<=` / `>=`. `<` was matched before `<<`. `#` started a fake line comment. `na` and bare `time` / `year` were colored as functions. `indicator(` increased indent for the rest of the file. |
| Snippets | `input.*` used `min=` (Pine is `minval=`). `label.new` used `label.style.label_up` (Pine is `label.style_label_up`). |
| Themes | Warning color was `#EEEEEE`, the same as the editor foreground. A light theme did not exist, and the default void token injection would have painted light-on-dark colors onto one. |
| Server missing | The status item only opened the output channel. A failed start did not offer install. Changing `pynescript.install.python` did not restart the client. |

## What changed

- One diagnostic collection when the server advertises pull, with the same severity filter on push and pull.
- Link lookup by column. Lookahead masks comments and strings without changing indexes.
- Inlay toggle and the setting stay in step with the editor decoration.
- Operator order, Pine namespaces (`font`, `earnings`, `dividends`, `splits`), `.psc` in the grammar, series names, `na` as a literal.
- Snippets above, plus `var`, `varip`, `method`, `import`, `alertcondition`, `bgcolor`, and a library annotation block.
- **AXIS Day** (`uiTheme: vs`). Contributed themes keep their own Pine colors; void is not injected on top of AXIS Day.
- Warning colors on all four themes. Status item uses the error background when the server is down and opens **PYNE: Language Server Status**.
- Format-on-save uses the editor tab size. Trace setting documented as `pyne-lsp.trace.server`.

## Not fixed here

- `series` / `simple` semantic token colors are contributed, and the themes color them, but `pyne-lsp` 0.6.34 does not put those types in its legend. Qualifiers and OHLCV names still color through the TextMate grammar. Emitting the types belongs in `hoox-sh/pyne`.
- Full formatting drops prose comments inside the server, so the client only pretty-prints a buffer that has no `//` notes. Buffers with notes get a trailing-whitespace trim. A comment-preserving formatter is server work.
- Series / `na` propagation versus Pyne Edge is still a server gap (see `docs/axis-pack-language-review.md`).
