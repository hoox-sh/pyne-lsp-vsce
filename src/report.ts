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

/**
 * One-paste troubleshooting report.
 *
 * Collects the resolved launch command, Python/pyne versions, client state,
 * and a settings snapshot. Every value goes through `redactSecrets` before it
 * reaches the clipboard or the output channel.
 */

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { env, ProgressLocation, version as vscodeVersion, window } from 'vscode';
import { cfg, effectiveSettingsSnapshot } from './config';
import { logDebug, logError } from './log';
import { isClientRunning, resolveLspLaunch } from './lsp';
import { redactSecrets } from './redact';
import { state } from './state';

function run(command: string, args: string[], timeout = 5000): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, encoding: 'utf8' }, (err, stdout) => {
      if (err) {
        resolve(undefined);
        return;
      }
      resolve(String(stdout).trim());
    });
  });
}

/** Async `which` / `where` so the report does not block the extension host. */
async function which(command: string): Promise<string | undefined> {
  const tool = process.platform === 'win32' ? 'where' : 'which';
  const out = await run(tool, [command], 3000);
  return out
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

/** Async interpreter probe; mirrors `resolvePythonForInstall` without sync spawns. */
async function resolvePythonAsync(): Promise<string | undefined> {
  const candidates = [
    (cfg<string>('install.python') || '').trim(),
    (cfg<string>('lsp.python') || '').trim(),
    'python3',
    'python',
    process.platform === 'win32' ? 'py' : '',
  ].filter((candidate) => candidate.length > 0);
  for (const python of candidates) {
    const isPath = python.includes('/') || python.includes('\\');
    if (isPath ? !fs.existsSync(python) : !(await which(python))) {
      continue;
    }
    if ((await run(python, ['--version'], 3000)) !== undefined) {
      return python;
    }
  }
  return undefined;
}

async function pythonFacts(python: string): Promise<string[]> {
  const [version, pyneVersion, langserver, mcp] = await Promise.all([
    run(python, ['-c', 'import sys; print(sys.version.split()[0])']),
    run(python, [
      '-c',
      'import importlib.metadata as m; print(m.version("hoox-pyne"))',
    ]),
    run(python, ['-c', 'import pynescript.langserver; print("ok")']),
    run(python, ['-c', 'import pynescript.mcp; import mcp; print("ok")']),
  ]);
  return [
    `version: ${version ?? 'unknown'}`,
    `hoox-pyne: ${pyneVersion ?? 'not installed'}`,
    `pynescript.langserver import: ${langserver ?? 'failed'}`,
    `pynescript.mcp import: ${mcp ?? 'failed'}`,
  ];
}

/** Build the plain-text report. Always redacted; safe to paste into an issue. */
export async function buildTroubleshootingReport(): Promise<string> {
  // Prefer the launch captured by startClient; only re-probe when the server
  // has not started yet (the probe spawns Python and can be slow).
  const launch = state.resolvedLaunch ?? resolveLspLaunch();
  const installPython = await resolvePythonAsync();
  const lspPython = (cfg<string>('lsp.python') || 'python3').trim() || 'python3';
  const python = installPython || lspPython;
  const [facts, pyneLsp, legacyLsp, pyneMcp] = await Promise.all([
    pythonFacts(python),
    which('pyne-lsp'),
    which('pynescript-lsp'),
    which('pyne-mcp'),
  ]);
  const settings = effectiveSettingsSnapshot();
  const client = state.client;

  const lines: string[] = [
    'PYNE troubleshooting report',
    `generated: ${new Date().toISOString()}`,
    `extension: ${state.extensionVersion || 'unknown'}`,
    `vscode: ${vscodeVersion}`,
    `os: ${os.platform()} ${os.release()} (${os.arch()})`,
    `node: ${process.versions.node}  electron: ${process.versions.electron ?? 'n/a'}`,
    '',
    'Language server',
    `  lsp.enabled: ${cfg<boolean>('lsp.enabled') !== false}`,
    `  client: ${client ? (isClientRunning() ? 'running' : 'created, not running') : 'not created'}`,
    `  resolved command: ${launch.command}`,
    `  resolved args: ${JSON.stringify(launch.args)}`,
    `  resolved label: ${launch.label}`,
    `  found: ${launch.found}`,
    `  pyne-lsp on PATH: ${pyneLsp ?? 'not found'}`,
    `  pynescript-lsp on PATH: ${legacyLsp ?? 'not found'}`,
    `  pyne-mcp on PATH: ${pyneMcp ?? 'not found'}`,
    `  trace.server: ${cfg<string>('trace.server') || 'off'}`,
    `  logging.level: ${cfg<string>('logging.level') || 'info'}`,
    '',
    'Python',
    `  install python: ${installPython ?? 'not found'}`,
    `  lsp python: ${lspPython}`,
    ...facts.map((line) => `  ${line}`),
    '',
    'Last error',
    state.lastError ? `  ${state.lastError.at}: ${state.lastError.message}` : '  none recorded',
    '',
    'Settings',
    JSON.stringify(settings, null, 2),
    '',
    'Secrets are redacted. Review the report before pasting it into a public issue.',
  ];
  return redactSecrets(lines.join('\n'));
}

/** Command entry point: collect, copy, and offer the output channel. */
export async function copyTroubleshootingReport(): Promise<void> {
  try {
    const report = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'PYNE: Collecting troubleshooting report…',
      },
      () => buildTroubleshootingReport(),
    );
    await env.clipboard.writeText(report);
    logDebug(`Troubleshooting report copied (${report.length} chars).`);
    const pick = await window.showInformationMessage(
      'PYNE troubleshooting report copied to the clipboard.',
      'Show Output',
    );
    if (pick === 'Show Output') {
      state.output?.show(true);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Could not build troubleshooting report: ${msg}`);
    void window.showErrorMessage(`PYNE could not build the troubleshooting report: ${msg}`);
  }
}
