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

import { type Event, type LogOutputChannel, LogLevel, ThemeColor } from 'vscode';
import { COMMANDS } from './commands';
import { cfg } from './config';
import { safeLogText } from './redact';
import { state } from './state';

const DOWN_HINT =
  'Click for the PYNE status menu (output, troubleshooting report, restart).';

export type LogLevelName = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const RANK: Record<Exclude<LogLevelName, 'off'>, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

/** Longest channel we keep before clearing it. Prevents a runaway log session. */
const MAX_LOG_LINES = 5000;

let emittedLines = 0;
let lastKey = '';
let repeats = 0;
let traceWrapper: LogOutputChannel | undefined;

/** `pynescript.logging.level`, normalised to a known level (default `info`). */
export function configuredLogLevel(): LogLevelName {
  const raw = String(cfg<string>('logging.level') || 'info').toLowerCase();
  return Object.prototype.hasOwnProperty.call(RANK, raw) || raw === 'off'
    ? (raw as LogLevelName)
    : 'info';
}

function shouldLog(level: Exclude<LogLevelName, 'off'>): boolean {
  const configured = configuredLogLevel();
  if (configured === 'off') {
    return false;
  }
  return RANK[level] >= RANK[configured];
}

function writeLine(level: Exclude<LogLevelName, 'off'>, text: string): void {
  const channel = state.output;
  if (!channel) {
    return;
  }
  if (emittedLines >= MAX_LOG_LINES) {
    channel.clear();
    emittedLines = 0;
    channel.appendLine(`[${new Date().toISOString()}] [info] [log truncated after ${MAX_LOG_LINES} lines]`);
    emittedLines += 1;
  }
  channel.appendLine(`[${new Date().toISOString()}] [${level}] ${text}`);
  emittedLines += 1;
  if (level === 'error') {
    state.lastError = { at: new Date().toISOString(), message: text };
  }
}

function flushRepeats(): void {
  if (repeats === 0) {
    return;
  }
  if (shouldLog('debug')) {
    const noun = repeats === 1 ? 'time' : 'times';
    writeLine('debug', `(previous line repeated ${repeats} more ${noun})`);
  }
  repeats = 0;
}

function emit(level: Exclude<LogLevelName, 'off'>, message: string): void {
  if (!state.output || !shouldLog(level)) {
    return;
  }
  const clean = safeLogText(message);
  const key = `${level}\u0000${clean}`;
  if (key === lastKey) {
    repeats += 1;
    return;
  }
  flushRepeats();
  lastKey = key;
  writeLine(level, clean);
}

/** Informational line. Backwards-compatible default used across the extension. */
export function log(msg: string): void {
  emit('info', msg);
}

export function logWarn(msg: string): void {
  emit('warn', msg);
}

export function logError(msg: string): void {
  emit('error', msg);
}

export function logDebug(msg: string): void {
  emit('debug', msg);
}

export function logTrace(msg: string): void {
  emit('trace', msg);
}

/** Visual separator in the output channel (start/stop/install boundaries). */
export function logSection(title: string): void {
  if (!state.output || !shouldLog('info')) {
    return;
  }
  flushRepeats();
  lastKey = '';
  writeLine('info', `──── ${title} ────`);
}

/**
 * Sink for `vscode-languageclient` trace output.
 *
 * The client reads `logLevel` and filters before calling `trace()`. VS Code's
 * `LogOutputChannel.logLevel` is read-only, so this thin wrapper reports
 * `Trace` and writes straight to the shared channel. `pynescript.trace.server`
 * then controls traffic independently of `pynescript.logging.level`.
 */
export function lspTraceChannel(): LogOutputChannel | undefined {
  const channel = state.output;
  if (!channel) {
    return undefined;
  }
  if (traceWrapper) {
    return traceWrapper;
  }
  const noopEvent: Event<LogLevel> = () => ({ dispose: () => undefined });
  traceWrapper = {
    name: channel.name,
    logLevel: LogLevel.Trace,
    onDidChangeLogLevel: noopEvent,
    trace: (message: string) => writeLine('trace', safeLogText(message, 20000)),
    debug: (message: string) => writeLine('debug', safeLogText(message, 20000)),
    info: (message: string) => writeLine('info', safeLogText(message)),
    warn: (message: string) => writeLine('warn', safeLogText(message)),
    error: (message: string) => writeLine('error', safeLogText(message)),
    append: (value: string) => channel.append(value),
    appendLine: (value: string) => channel.appendLine(value),
    replace: (value: string) => channel.replace(value),
    clear: () => channel.clear(),
    show: (...args: any[]) => (channel.show as (...a: any[]) => void)(...args),
    hide: () => channel.hide(),
    dispose: () => undefined,
  };
  return traceWrapper;
}

/** Update the status bar. Click opens the PYNE status menu. */
export function setStatus(text: string, tooltip?: string, down = false): void {
  if (!state.statusBar) return;
  state.statusBar.text = text;
  state.statusBar.command = COMMANDS.showStatus;
  const detail = tooltip || text;
  state.statusBar.tooltip = down ? `${detail}\n${DOWN_HINT}` : detail;
  state.statusBar.backgroundColor = down
    ? new ThemeColor('statusBarItem.errorBackground')
    : undefined;
  state.statusBar.color = down
    ? new ThemeColor('statusBarItem.errorForeground')
    : undefined;
  state.statusBar.show();
}
