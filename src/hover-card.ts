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
 * VS Code-only hover decoration.
 *
 * The language server emits a client-agnostic Markdown card whose first line
 * is an inline-code kind chip (`function`, `namespace`, …). VS Code can render
 * ThemeIcons, so the client prefixes that chip with a matching codicon while
 * Neovim/Zed keep the plain Markdown.
 */

/**
 * Shared kind vocabulary → codicon name (without the `$()` wrapper).
 *
 * `profile` is client-only, for the gutter line-profile hover. It is not an
 * LSP symbol kind. Icon is the `pulse` codicon.
 */
export const KIND_ICONS: Record<string, string> = {
  function: 'symbol-function',
  method: 'symbol-method',
  property: 'symbol-property',
  namespace: 'symbol-namespace',
  type: 'symbol-structure',
  qualifier: 'symbol-parameter',
  mode: 'symbol-constant',
  keyword: 'symbol-keyword',
  variable: 'symbol-variable',
  enum: 'symbol-enum',
  member: 'symbol-enum-member',
  constructor: 'symbol-constructor',
  library: 'library',
  declaration: 'symbol-misc',
  profile: 'pulse',
};

const KIND_CHIP = /^`([a-z][a-z0-9_-]*)`/;
/** A codicon already sits at the start of the card. */
const LEADING_CODICON = /^\$\([a-z0-9-]+\)/;

/**
 * Prefix the card's leading kind chip with one codicon.
 *
 * Returns `undefined` when the markdown has no known kind chip at the start,
 * or a codicon is already present, so callers leave the hover byte-for-byte
 * untouched. A second call does not stack another icon.
 */
export function decorateHoverMarkdown(markdown: string): string | undefined {
  if (LEADING_CODICON.test(markdown)) return undefined;
  const match = KIND_CHIP.exec(markdown);
  if (!match) return undefined;
  const icon = KIND_ICONS[match[1]];
  if (!icon) return undefined;
  return `$(${icon}) ${markdown}`;
}
