# PYNE VS Code Extension — Feature Support Matrix

Extension `hoox-sh.pyne` (this repo: `vscode-extension/`). The extension has two
independent subsystems:

1. **Language server (`pyne-lsp`)** — a local stdio process spawned from your
   Python environment (`pip install "hoox-pyne[lsp]"`). It never calls a backend.
2. **Pro API client** — plain `fetch` calls against a configurable backend
   (`PYNE: Smoke /run (one bar)` → `POST /run`, `PYNE: Test Backend` → `GET /health`).
   Chart run is AXIS, not this extension.

Deployment modes:

| Mode | How | Auth |
| --- | --- | --- |
| **Hosted Pro (remote)** | `pynescript.backend.useHosted=true` → `https://pynescript.online` | Pro API key required (**PYNE: Set Pro API Key**, SecretStorage) |
| **Self-hosted local** | Flask Pro API on `http://127.0.0.1:5002` (`make run`, `make docker-up`, or `PYNE: Start Backend`) | No key for `POST /run` (free-tier endpoint); key accepted if set |
| **Self-hosted remote** | Same Flask Pro API on your own host (`pynescript.backend.url`) | Same as local (key optional; recommended if exposed) |
| **Self-hosted edge** | [`pyne-worker`](https://github.com/jango-blockchained/pyne-worker) on Cloudflare — `POST /run`, `/health`, `/scripts`, `/cron/*` | Tenant `Bearer hx_live_…` key when auth is enabled on the worker |
| **None** | No backend configured | — |

Legend: ✅ supported · ⚠️ partial / conditional · ❌ not available · — not applicable (the extension never calls it)

## Feature matrix

| Functionality | Hosted Pro (key) | Self-hosted local | Self-hosted remote | Self-hosted edge | No backend |
| --- | --- | --- | --- | --- | --- |
| Pine grammar highlighting (`.pyne` / `.pine` / `.psc` → language id `pinescript`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Color themes (`pyne-volt`, `hoox-signal`, `axis-void`, light `axis-day`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PYNE: Select Syntax Highlighting** (`none` / `void` / `signal` / `volt`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Snippets (declaration + builtin) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Diagnostics — parse + lint (pull + push) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Diagnostics — style / semantic (opt-in) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Completion (+ resolve, snippets, user symbols) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hover cards (AXIS Markdown card + builtin/user docs) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Semantic tokens (`series` / `simple` legend tail + theme colors) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Format Document (comments kept on pyne-lsp ≥ 0.6.35 or a `series`/`simple` legend; otherwise comment-free only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Static lookahead grep (`pyne.lookahead.static`; not live-taint) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Signature help while typing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Definition / references / rename (+ prepare) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Document + workspace symbols | ✅ | ✅ | ✅ | ✅ | ✅ |
| Document highlight / linked editing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Semantic tokens (full + range) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Folding / selection range | ✅ | ✅ | ✅ | ✅ | ✅ |
| Document color swatches (`#hex`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Document links (+ resolve) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inlay hints — parameter names (opt-in, default off) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inlay hints — inferred types | ❌ removed | ❌ removed | ❌ removed | ❌ removed | ❌ removed |
| Formatting (document / range / on-type / format-on-save) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Convert to v6 (code action + command, local, undoable) | ✅ | ✅ | ✅ | ✅ | ✅ |
| PYNE: Restart Server / Show LSP Output / Show LSP Command | ✅ | ✅ | ✅ | ✅ | ✅ |
| PYNE: Install Language Server (`hoox-pyne[lsp]`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PYNE: Smoke /run (one bar)** (`POST /run`, mode `auto`, **not a chart**) | ✅ key required | ✅ no key needed | ✅ key optional | ✅ tenant key when auth on | ❌ |
| **PYNE: Test Backend** (`GET /health`) | ✅ | ✅ | ✅ | ✅ (worker `/health`) | ❌ |
| PYNE: Install Backend (`hoox-pyne[pro,lsp]`) | — not needed | ✅ | ⚠️ installs into the local env only | ⚠️ installs into the local env only | ⚠️ installs, but nothing to start automatically |
| PYNE: Start Backend (`python -m backend.app`) | ❌ blocked by `useHosted` | ✅ | ❌ backend runs elsewhere | ❌ backend runs elsewhere | ✅ (this is how you get one) |
| Real market data, live sessions (`/data/*`)¹ | ✅ key | ✅ key | ✅ key | ❌ no `/data` on worker | ❌ |
| Optimize / backtest / preview endpoints¹ | ✅ key | ✅ | ✅ | ❌ | ❌ |
| Hosted runner (`/scripts`, `/cron/*`)¹ | ✅ key | ✅ admin token to mint | ✅ | ✅ (worker native) | ❌ |

¹ **Not exposed by the extension today** — reachable from the Pro API directly
(AXIS, agents, `curl`) and via PYNE MCP runner/data tools. Listed for completeness
because availability differs per deployment.

### Notes

- All LSP features run **inside the editor** against `pyne-lsp`; no column
  changes for them. The only requirement is a Python env with `hoox-pyne[lsp]`.
- Inferred-type inlay hints were removed entirely (v0.5.3 server, extension
  0.5.3+): the server never annotates declarations. Parameter-name hints remain
  but default **off** (`pynescript.inlayHints.parameters` and `[pinescript]
  editor.inlayHints.enabled`).
- **PYNE: Select Syntax Highlighting** is local (Pine-scoped TextMate /
  semantic-token rules on the global token color customizations; VS Code
  rejects a language override for that setting). It works in every
  deployment mode, including no backend.
- `PYNE: Smoke /run (one bar)` sends the full script plus a **single** synthetic
  OHLCV bar (`mode: auto`) to the configured backend — hosted, local, remote, or
  edge. That is a compile/execute smoke test. **AXIS: Run Script** owns history
  bars and chart paint. This extension does not open a chart.
- Local smoke does **not** require `pynescript.pro.enabled`. Hosted
  `pynescript.online` still does, plus an API key stored via **PYNE: Set Pro API Key**
  (SecretStorage — there is no `pynescript.pro.apiKey` setting).
- The hosted backend fronts `/run` with the Pro API key; self-hosted Flask
  `/run` is an open free-tier endpoint. If you expose a self-hosted instance
  publicly, put auth in front of it.
- Language id is **`pinescript`** for `.pyne` / `.pine` / `.psc` so AXIS
  `when` clauses (`editorLangId == pinescript`) match. Incoming `pine` / `pyne`
  modes are remapped to `pinescript`. Do not add a second language id.
