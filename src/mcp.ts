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
 * Register the PYNE MCP server with VS Code / Copilot agent mode.
 *
 * The server (`pyne-mcp`, or `python -m pynescript.mcp`) is the same stdio
 * MCP server shipped by the `hoox-pyne[mcp]` extra. Registering it here means
 * users do not need a manual `.mcp.json` entry to get `pyne_check`,
 * `pyne_lint`, `pyne_compile`, `pyne_run`, `pyne_convert`, and friends.
 */

import * as fs from 'fs';
import {
  EventEmitter,
  ExtensionContext,
  lm,
  McpStdioServerDefinition,
  workspace,
} from 'vscode';
import { cfg, resolveBackendUrl } from './config';
import { commandOnPath, commandPath, pythonCanImportMcp } from './install';
import { log, logDebug, logWarn } from './log';
import { resolveLspLaunch } from './lsp';

export const MCP_PROVIDER_ID = 'pynescript.mcp';

export type McpLaunch = {
  command: string;
  args: string[];
  label: string;
  found: boolean;
};

/**
 * Resolve how to spawn the MCP server.
 *
 * Discovery (in order):
 *  1. `pynescript.mcp.command` if set and not `auto`
 *  2. the Python used for `python -m pynescript.langserver` (validated by import)
 *  3. `pynescript.mcp.python` / `pynescript.lsp.python` / `python3`
 *  4. `pyne-mcp` on `PATH` (fallback for Nuitka installs without Python)
 */
export function resolveMcpLaunch(): McpLaunch {
  const configured = (cfg<string>('mcp.command') || 'auto').trim();
  const python =
    (cfg<string>('mcp.python') || cfg<string>('lsp.python') || 'python3').trim() ||
    'python3';

  if (configured && configured !== 'auto') {
    return {
      command: configured,
      args: [],
      label: configured,
      found: fs.existsSync(configured) || commandOnPath(configured),
    };
  }

  // Prefer a Python that can actually import the server: a stale `pyne-mcp`
  // shim on PATH is otherwise indistinguishable from a working one.
  const candidates = new Set<string>();
  const lsp = resolveLspLaunch();
  if (lsp.command !== 'docker' && lsp.args.includes('-m')) {
    candidates.add(lsp.command);
  }
  // If the resolved LSP is a script (pip console entry), its shebang points at
  // the interpreter that owns the install — usually the right Python for MCP.
  const lspPath = commandPath(lsp.command);
  const lspFirstLine = lspPath ? readFirstLine(lspPath) : undefined;
  if (lspFirstLine !== undefined) {
    const shebang = parseShebang(lspFirstLine);
    if (shebang.kind === 'script') {
      candidates.add(shebang.interpreter);
    }
  }
  candidates.add(python);

  for (const candidate of candidates) {
    if (candidate && pythonCanImportMcp(candidate)) {
      return {
        command: candidate,
        args: ['-m', 'pynescript.mcp'],
        label: `${candidate} -m pynescript.mcp`,
        found: true,
      };
    }
  }

  const mcpPath = commandPath('pyne-mcp');
  if (mcpPath) {
    const firstLine = readFirstLine(mcpPath);
    if (firstLine === undefined) {
      logWarn('Ignoring pyne-mcp on PATH: cannot read the executable');
    } else {
      const shebang = parseShebang(firstLine);
      if (shebang.kind === 'native') {
        return { command: 'pyne-mcp', args: [], label: 'pyne-mcp', found: true };
      }
      if (shebang.kind === 'script' && pythonCanImportMcp(shebang.interpreter)) {
        return { command: 'pyne-mcp', args: [], label: 'pyne-mcp', found: true };
      }
      logWarn('Ignoring pyne-mcp on PATH: its interpreter cannot import pynescript.mcp (stale install?)');
    }
  }

  return {
    command: 'pyne-mcp',
    args: [],
    label: 'pyne-mcp (not found — pip install "hoox-pyne[mcp]")',
    found: false,
  };
}

type Shebang =
  | { kind: 'native' }
  | { kind: 'script'; interpreter: string }
  | { kind: 'invalid' };

/** First line of *bin*, or `undefined` when it cannot be read. */
function readFirstLine(bin: string): string | undefined {
  let fd: number | undefined;
  try {
    fd = fs.openSync(bin, 'r');
    const buffer = Buffer.alloc(256);
    const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, read).toString('utf8').split('\n')[0];
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore close errors */
      }
    }
  }
}

/** Classify a first line as a native binary, a script, or a broken shebang. */
function parseShebang(firstLine: string): Shebang {
  if (!firstLine.startsWith('#!')) {
    return { kind: 'native' };
  }
  const parts = firstLine
    .slice(2)
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { kind: 'invalid' };
  }
  let command = parts[0];
  if (command === 'env' || command.endsWith('/env')) {
    command = parts[1] ?? '';
  }
  return command.length > 0 ? { kind: 'script', interpreter: command } : { kind: 'invalid' };
}

/** Register the MCP provider on activation (the setting is checked on demand). */
export function registerMcpServer(context: ExtensionContext): void {
  // Resolve lazily: activation must not block on `which`/Python probes, and
  // VS Code only asks for definitions when agent mode needs them.
  let cached: McpLaunch | undefined;
  const changed = new EventEmitter<void>();
  const version = String(context.extension.packageJSON.version ?? '0.0.0');
  context.subscriptions.push(
    changed,
    lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
      onDidChangeMcpServerDefinitions: changed.event,
      provideMcpServerDefinitions: () => {
        if (cfg<boolean>('mcp.enabled') === false) {
          return [];
        }
        cached ??= resolveMcpLaunch();
        if (!cached.found) {
          logDebug(`MCP server not found: ${cached.label}`);
          return [];
        }
        const definition = new McpStdioServerDefinition(
          'PYNE',
          cached.command,
          cached.args,
          {
            PYNE_MCP_TRANSPORT: 'stdio',
            PYNE_API_URL: resolveBackendUrl(),
          },
          version,
        );
        definition.cwd = workspace.workspaceFolders?.[0]?.uri;
        return [definition];
      },
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('pynescript.mcp') ||
        event.affectsConfiguration('pynescript.backend')
      ) {
        cached = undefined;
        changed.fire();
      }
    }),
  );

  log(
    cfg<boolean>('mcp.enabled') === false
      ? 'MCP provider registered (disabled via pynescript.mcp.enabled)'
      : 'Registered MCP server provider (resolved on demand)',
  );
}
