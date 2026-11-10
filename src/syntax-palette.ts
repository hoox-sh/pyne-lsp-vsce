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

/** Workbench theme label → the palette that theme already ships. */
const THEME_PALETTE: Record<string, string> = {
  'AXIS Void': 'void',
  'Hoox Signal': 'signal',
  'PYNE Volt': 'volt',
  'AXIS Day': 'day',
};

const ALIASES: Record<string, string> = { orange: 'signal' };

/**
 * Which Pine token palette to inject into `editor.tokenColorCustomizations`.
 *
 * `none` means "do not inject" — the active theme's own token colors apply.
 * Contributed HOOX themes already color Pine scopes, so injecting the same
 * palette would only duplicate them. The dark `void` default must not be
 * painted onto AXIS Day: those tokens are light-on-dark and disappear on paper.
 */
export function resolveSyntaxInjection(
  configured: string | undefined,
  activeTheme: string | undefined,
): string {
  const raw = (configured || 'void').trim().toLowerCase();
  const id = ALIASES[raw] ?? raw;
  const syntax = id === 'none' || id === 'void' || id === 'signal' || id === 'volt' ? id : 'void';
  if (syntax === 'none') {
    return 'none';
  }
  const themePalette = THEME_PALETTE[(activeTheme || '').trim()];
  if (!themePalette) {
    return syntax;
  }
  if (syntax === themePalette) {
    return 'none';
  }
  if (syntax === 'void' && themePalette === 'day') {
    return 'none';
  }
  return syntax;
}
