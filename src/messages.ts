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

/** Toast after an in-place v4/v5 → v6 rewrite. */
export function convertSuccessMessage(fromVersion?: number): string {
  const undo = 'Undo with Ctrl/Cmd+Z if that was not intended.';
  if (typeof fromVersion === 'number' && fromVersion > 0 && fromVersion < 6) {
    return `Converted Pine v${fromVersion} → v6. ${undo}`;
  }
  return `Converted script to Pine v6. ${undo}`;
}

/** One-line toast after a successful one-bar /run smoke. Never implies a chart. */
export function summarizeSmokeResult(result: unknown): string {
  const base =
    'One-bar /run smoke succeeded (no chart). Use AXIS: Run Script for history bars and plots.';
  if (!result || typeof result !== 'object') {
    return base;
  }
  const rec = result as Record<string, unknown>;
  const bits: string[] = [];
  if (Array.isArray(rec.plots)) {
    bits.push(`${rec.plots.length} plot(s)`);
  }
  if (typeof rec.message === 'string' && rec.message.trim()) {
    bits.push(rec.message.trim().slice(0, 120));
  }
  return bits.length ? `${base} ${bits.join(' · ')}` : base;
}
