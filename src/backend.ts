// Copyright (C) 2024-2026 jango_blockchained
//
// This file is part of pynescript.
//
// pynescript is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// pynescript is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with pynescript.  If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as fs from 'fs';
import * as path from 'path';
import { commands, extensions, window, workspace } from 'vscode';
import { cfg, expandWorkspaceVars, resolveBackendUrl } from './config';
import { resolvePythonForInstall } from './install';
import { AXIS_IDE_EXTENSION_ID, AXIS_RUN_SCRIPT_COMMAND, isPineDocument } from './language';
import { log } from './log';
import { summarizeSmokeResult } from './messages';
import { getProKey } from './secrets';
import { state } from './state';

/**
 * Start the PYNE backend from a checkout (`python -m backend.app`) in a
 * terminal. Uses `pynescript.backend.path` or the first workspace folder.
 */
export async function startBackend(): Promise<void> {
  if (cfg<boolean>('backend.useHosted') === true) {
    void window.showWarningMessage(
      'PYNE: pynescript.backend.useHosted is on (pynescript.online). ' +
        'Turn it off to start a local backend.',
    );
    return;
  }
  const configured = (cfg<string>('backend.path') || '').trim();
  const baseDir = configured
    ? expandWorkspaceVars(configured)
    : (workspace.workspaceFolders?.[0]?.uri.fsPath ?? '');
  if (!baseDir) {
    void window.showErrorMessage(
      'PYNE: no workspace folder. Set pynescript.backend.path to a PYNE checkout, ' +
        'or enable pynescript.backend.useHosted to use pynescript.online.',
    );
    return;
  }
  const appPy = path.join(baseDir, 'backend', 'app.py');
  if (!fs.existsSync(appPy)) {
    void window.showErrorMessage(
      `PYNE: backend/app.py not found under ${baseDir}. Set pynescript.backend.path to a PYNE checkout, ` +
        'or enable pynescript.backend.useHosted to use pynescript.online.',
    );
    return;
  }
  const python = resolvePythonForInstall() || (cfg<string>('lsp.python') || 'python3').trim() || 'python3';
  const url = resolveBackendUrl();
  let port = '5002';
  try {
    const parsed = new URL(url);
    port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch {
    /* keep default */
  }
  const env: Record<string, string | undefined> = { ...process.env, PORT: port };
  const term = window.createTerminal({ name: 'PYNE Backend', cwd: baseDir, env });
  term.show(true);
  term.sendText(`"${python}" -m backend.app`, true);
  log(`Started backend: ${python} -m backend.app (cwd=${baseDir}, PORT=${port})`);
  void window.showInformationMessage(`PYNE backend starting on ${url}. See the “PYNE Backend” terminal.`);
}

/** Ping the configured backend `/health` endpoint. */
export async function testBackend(): Promise<void> {
  const url = resolveBackendUrl();
  const health = `${url}/health`;
  log(`GET ${health}`);
  try {
    const res = await fetch(health, { method: 'GET' });
    const text = await res.text();
    if (res.ok) {
      void window.showInformationMessage(`PYNE backend OK (HTTP ${res.status}) at ${url}.`);
    } else {
      void window.showWarningMessage(`PYNE backend returned HTTP ${res.status} at ${health}.`);
    }
    log(`Backend health ${res.status}: ${text.slice(0, 500)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void window.showErrorMessage(`PYNE backend unreachable at ${health}: ${msg}`);
    log(`Backend health failed: ${msg}`);
  }
}

export function isAxisIdePresent(): boolean {
  return !!extensions.getExtension(AXIS_IDE_EXTENSION_ID);
}

export { summarizeSmokeResult } from './messages';

/**
 * POST the active Pine buffer to `/run` with **one synthetic bar**.
 *
 * This is a compile/execute smoke test. AXIS owns chart run (history bars +
 * plots). PYNE must not open a second chart.
 */
export async function runOnPro(): Promise<void> {
  const editor = window.activeTextEditor;
  if (!editor || !isPineDocument(editor.document)) {
    void window.showWarningMessage('No active .pyne / .pine document to smoke-test.');
    return;
  }
  const apiKey = state.secrets ? ((await getProKey(state.secrets)) || '').trim() : '';
  const useHosted = cfg<boolean>('backend.useHosted') === true;
  const endpoint = resolveBackendUrl();
  if (useHosted && cfg<boolean>('pro.enabled') === false) {
    void window.showWarningMessage(
      'Hosted /run is off. Enable pynescript.pro.enabled or turn off pynescript.backend.useHosted for a local smoke.',
    );
    return;
  }
  if (useHosted && !apiKey) {
    void window.showWarningMessage(
      'PYNE: the hosted backend (pynescript.online) requires a Pro API key. ' +
        'Run “PYNE: Set Pro API Key” (SecretStorage) or turn off pynescript.backend.useHosted.',
    );
    return;
  }
  const source = editor.document.getText();
  const url = `${endpoint}/run`;
  // Minimal single-bar OHLCV so the script at least compiles/executes.
  const body = {
    script: source,
    data: [{ open: 100, high: 101, low: 99, close: 100, volume: 1000 }],
    symbol: 'CHART',
    mode: 'auto',
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  log(`PYNE /run smoke POST ${url} (script ${source.length} chars, 1 bar)`);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    let result: Record<string, unknown>;
    try {
      result = (await res.json()) as Record<string, unknown>;
    } catch {
      result = { status: 'error', code: 'INVALID_RESPONSE', message: `HTTP ${res.status}` };
    }
    if (!res.ok) {
      void window.showErrorMessage(
        `PYNE /run smoke failed: ${String(result.code ?? 'HTTP ' + res.status)} — ${String(result.message ?? '')}`,
      );
      return;
    }
    if (result.status === 'error') {
      void window.showErrorMessage(
        `PYNE /run smoke: ${String(result.code ?? 'error')} — ${String(result.message ?? '')}`,
      );
      return;
    }
    log(`PYNE /run smoke result: ${JSON.stringify(result).slice(0, 2000)}`);
    const axis = isAxisIdePresent();
    const pick = await window.showInformationMessage(
      summarizeSmokeResult(result),
      ...(axis ? (['AXIS: Run Script', 'Show Output'] as const) : (['Show Output'] as const)),
    );
    if (pick === 'Show Output') {
      // Output channel is owned by the extension host; command is registered.
      await commands.executeCommand('pynescript.showLspOutput');
    } else if (pick === 'AXIS: Run Script') {
      await commands.executeCommand(AXIS_RUN_SCRIPT_COMMAND);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`PYNE /run smoke failed: ${msg}`);
    void window.showErrorMessage(`PYNE /run smoke failed: ${msg}`);
  }
}
