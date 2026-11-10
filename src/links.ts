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

const URL_RE = /https?:\/\/[^\s<>"'`*]+/g;

/**
 * Return the http(s) URL covering `character` on a single line.
 *
 * `character` is a column on `lineText`, not a document offset. Callers that
 * pass `document.offsetAt` will miss every link below line 1.
 */
export function findUrlOnLine(lineText: string, character: number): string | undefined {
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(lineText)) !== null) {
    const trimmed = match[0].replace(/[.,;:!?)]+$/, '');
    const start = match.index;
    const end = start + trimmed.length;
    if (character >= start && character <= end) {
      return trimmed;
    }
  }
  return undefined;
}
