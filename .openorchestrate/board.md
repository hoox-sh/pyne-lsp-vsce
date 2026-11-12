# Board

> One place for work. Statuses: Todo · Working · Blocked · Ready for Review · Done.
> Nothing is done until this file says Done.

| task                                                           | owner     | status  | priority | proof                                                                                                | blockedReason | source                     | updated    | Id                                        |
| -------------------------------------------------------------- | --------- | ------- | -------- | ---------------------------------------------------------------------------------------------------- | ------------- | -------------------------- | ---------- | ----------------------------------------- |
| Editor pass: fix LSP, grammar, theme, screenshots              | oo-spec-2 | Done    | P1       | verify.sh 3 passed 2 skipped; test:unit passed; PR72 legend probe; docs/editor-pass.md               |               | user request               | 2026-11-10 | editor-pass-pyne-lsp-vsce-011f            |
| Review pyne-lsp-vsce: fine-tune language surface for AXIS pack | oo-misc   | Done    | P1       | checker PASS: `./scripts/verify.sh` 4 passed 1 skipped; artifact `docs/axis-pack-language-review.md` |               | AXIS pack language surface | 2026-11-09 | review-pyne-lsp-vsce-fine-tune-l-ce599ae0 |
| Raise OpenOrchestrate maturity to L7 (daily clock)             | oo-ops    | Done    |          | checker 5764f741                                                                                     |               |                            | 2026-11-09 | raise-openorchestrate-maturity-t-40efcee2 |
| Fix LSP stale errors after correcting a script                 | oo-misc   | Ready for Review | P1 | 358 LSP tests pass; e2e stdio pull returns `[]` after fix and `workspace/diagnostic/refresh` received; `verify.sh pre-commit` lint+typecheck pass |               | LSP stale diagnostics report | 2026-11-12 | fix-lsp-stale-errors-after-corre-6185bd4f |
| Review LSP 3.18 / VS Code 1.146 feature gaps                   | oo-misc   | Ready for Review | P1 | artifact `docs/lsp-feature-gaps-2026.md` (versions verified: pygls 2.1.1, languageclient 11.0.0, @types/vscode 1.146.0) |               | LSP/VS Code 2026 review      | 2026-11-12 | review-lsp-3-18-vs-code-1-146-fe-a89069a6 |
| Integrate LSP 3.18 features and PYNE MCP registration          | oo-misc   | Ready for Review | P1 | 386 LSP tests pass (28 new) + 3 extension manifest tests; e2e stdio: capabilities + lens + call hierarchy + type def + inline `close, 14)`; `pyne-mcp` initialize handshake OK; review follow-ups fixed (lazy LSP start, MCP validation, lens refresh, workspace-pull parity); tsc/eslint/verify pre-commit pass |               | LSP/VS Code 2026 review      | 2026-11-12 | integrate-lsp-3-18-features-and--12611cea |
| Fine-tune logging and troubleshooting                          | oo-misc   | Ready for Review | P1 | `npm run test:unit` 60 pass (4 new redaction tests); `./scripts/verify.sh pre-commit` 3 pass 1 skip; `npm run compile` OK; new `pynescript.logging.level` / `pynescript.trace.server`, redacted `PYNE: Copy Troubleshooting Report`, status-menu/error actions |               | user request                 | 2026-11-12 | fine-tune-logging-and-troublesh-7c4e2a11 |

## Rules

- Every card has one owner.
- Five statuses, no more: Todo · Working · Blocked · Ready for Review · Done.
- If you are stuck, set Blocked, write why, and ping the Chief.
- Pass work as a handoff, not a transcript.
- A card moves to Done only with proof attached.

## Handoff format

```text
from:
to:
objective:
artifacts:
decisions:
open questions:
next gate:
```
