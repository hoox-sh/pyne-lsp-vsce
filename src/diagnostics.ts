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
 * Severity numbers are the VS Code `DiagnosticSeverity` enum
 * (Error 0, Warning 1, Information 2, Hint 3), not the LSP enum
 * (Error 1 … Hint 4). The language client converts before middleware.
 */
const VSCODE_SEVERITY: Record<string, number> = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

export function diagnosticCodeText(code: unknown): string {
  if (typeof code === 'string' || typeof code === 'number') {
    return String(code);
  }
  if (code && typeof code === 'object' && 'value' in code) {
    const value = (code as { value?: unknown }).value;
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

export function filterDiagnostics<T extends { code?: unknown; severity?: number }>(
  diagnostics: T[],
  options: { enabled: boolean; severity?: Record<string, string> | undefined },
): T[] {
  if (!options.enabled) {
    return [];
  }
  const overrides = options.severity ?? {};
  const keys = Object.keys(overrides);
  if (keys.length === 0) {
    return diagnostics;
  }
  return diagnostics.map((diagnostic) => {
    const code = diagnosticCodeText(diagnostic.code);
    for (const prefix of keys) {
      if (prefix.length > 0 && code.startsWith(prefix)) {
        const severity = VSCODE_SEVERITY[overrides[prefix]];
        return severity === undefined ? diagnostic : { ...diagnostic, severity };
      }
    }
    return diagnostic;
  });
}
