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
 * Redaction and truncation helpers for the PYNE output channel and the
 * troubleshooting report.
 *
 * Keep this module free of `vscode` imports so it can be unit-tested with
 * plain Node.
 */

const TOKEN_PATTERNS: Array<[RegExp, string]> = [
  // URL userinfo: https://user:password@host
  [/(\bhttps?:\/\/[^\s/:@]+):([^\s/@]+)@/gi, '$1:***@'],
  // HOOX tenant / Pro keys.
  [/\b(hx_(?:live|test)_)[A-Za-z0-9_-]{4,}\b/gi, '$1***'],
  // Common vendor tokens.
  [/\b(sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/g, '$1***'],
  // Authorization headers.
  [/\b(Bearer\s+)[A-Za-z0-9._~+/-]{6,}=*/gi, '$1***'],
  // JSON / env style key-value pairs.
  [
    /(["']?(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|password|authorization)["']?\s*[:=]\s*["']?)(?!\*{3})[^"'\s,;}]+/gi,
    '$1***',
  ],
  // SCREAMING_SNAKE env assignments (PYNE_API_KEY=..., GITHUB_TOKEN=...).
  [/\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD))\s*=\s*[^\s,;]+/g, '$1=***'],
];

/** Replace credentials in *input* with `***`. Safe to call on any string. */
export function redactSecrets(input: string): string {
  let out = input;
  for (const [pattern, replacement] of TOKEN_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Cap a log line so a runaway payload cannot flood the channel. */
export function truncateForLog(input: string, max = 4000): string {
  if (max <= 0 || input.length <= max) {
    return input;
  }
  const omitted = input.length - max;
  return `${input.slice(0, max)}… (${omitted} more chars)`;
}

/** Redact, then truncate — the order matters so a secret is never cut in half. */
export function safeLogText(input: string, max = 4000): string {
  return truncateForLog(redactSecrets(input), max);
}
