# Board

> One place for work. Statuses: Todo · Working · Blocked · Ready for Review · Done.
> Nothing is done until this file says Done.

| task                                                           | owner     | status  | priority | proof                                                                                                | blockedReason | source                     | updated    | Id                                        |
| -------------------------------------------------------------- | --------- | ------- | -------- | ---------------------------------------------------------------------------------------------------- | ------------- | -------------------------- | ---------- | ----------------------------------------- |
| Editor pass: fix LSP, grammar, theme, screenshots             | oo-spec-2 | Done    | P1       | verify.sh 3 passed 2 skipped; test:unit 46 passed; VS Code 1.145 VSIX; docs/editor-pass.md          |               | user request               | 2026-11-10 | editor-pass-pyne-lsp-vsce-011f            |
| Review pyne-lsp-vsce: fine-tune language surface for AXIS pack | oo-misc   | Done    | P1       | checker PASS: `./scripts/verify.sh` 4 passed 1 skipped; artifact `docs/axis-pack-language-review.md` |               | AXIS pack language surface | 2026-11-09 | review-pyne-lsp-vsce-fine-tune-l-ce599ae0 |
| Raise OpenOrchestrate maturity to L7 (daily clock)             | oo-ops  | Done   |          | checker 5764f741                                                                                     |               |                            | 2026-11-09 | raise-openorchestrate-maturity-t-40efcee2 |

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
