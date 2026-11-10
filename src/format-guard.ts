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

/** First server release that keeps comments while formatting and advertises the legend. */
export const COMMENT_PRESERVING_VERSION = '0.6.35';

/** True when `version` is at least `minimum` (`major.minor.patch`). Junk is not. */
export function serverVersionAtLeast(version: string | undefined, minimum: string): boolean {
  const parse = (value: string): [number, number, number] | undefined => {
    const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      return undefined;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const got = version ? parse(version) : undefined;
  const need = parse(minimum);
  if (!got || !need) {
    return false;
  }
  for (let i = 0; i < 3; i += 1) {
    if (got[i] !== need[i]) {
      return got[i] > need[i];
    }
  }
  return true;
}

/**
 * Full formatting keeps comments when the initialize legend ends with
 * `series` then `simple`, or when `serverInfo.version` is at least 0.6.35.
 * hoox-pyne 0.6.34 advertises neither, so it stays on the comment-free guard.
 */
export function serverPreservesComments(input: {
  tokenTypes?: readonly string[] | undefined;
  version?: string | undefined;
}): boolean {
  return (
    legendPreservesComments(input.tokenTypes) ||
    serverVersionAtLeast(input.version, COMMENT_PRESERVING_VERSION)
  );
}

/** Pull `legend.tokenTypes` off an LSP initialize capabilities object. */
export function legendFromCapabilities(capabilities: unknown): string[] | undefined {
  if (!capabilities || typeof capabilities !== 'object') {
    return undefined;
  }
  const provider = (capabilities as { semanticTokensProvider?: unknown }).semanticTokensProvider;
  if (!provider || typeof provider !== 'object') {
    return undefined;
  }
  const types = (provider as { legend?: { tokenTypes?: unknown } }).legend?.tokenTypes;
  if (!Array.isArray(types) || types.some((token) => typeof token !== 'string')) {
    return undefined;
  }
  return types as string[];
}

export function legendPreservesComments(tokenTypes: readonly string[] | undefined): boolean {
  if (!tokenTypes || tokenTypes.length < 2) {
    return false;
  }
  return tokenTypes[tokenTypes.length - 2] === 'series' && tokenTypes[tokenTypes.length - 1] === 'simple';
}

/**
 * True when a pretty-print would drop trivia on a server that only unparses.
 *
 * Full-line `//@` annotations are kept by every server. Prose `//` comments,
 * trailing comments, block comments, and `#` comments (not a hex color) are not.
 */
export function hasDroppableComments(source: string): boolean {
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const triple = source.slice(i, i + 3);
      if (triple === '"""' || triple === "'''") {
        const end = source.indexOf(triple, i + 3);
        i = end < 0 ? n : end + 3;
        continue;
      }
      i += 1;
      while (i < n) {
        const c = source[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        i += 1;
        if (c === ch || c === '\n') {
          break;
        }
      }
      continue;
    }
    if (ch === '/' && i + 1 < n) {
      if (source[i + 1] === '*') {
        return true;
      }
      if (source[i + 1] === '/') {
        const lineEnd = source.indexOf('\n', i);
        const end = lineEnd < 0 ? n : lineEnd;
        const lineStart = source.lastIndexOf('\n', Math.max(0, i - 1)) + 1;
        const prefix = source.slice(lineStart, i).trim();
        const body = source.slice(i + 2, end).trim();
        if (prefix.length === 0 && body.startsWith('@')) {
          i = end;
          continue;
        }
        return true;
      }
    }
    if (ch === '#') {
      const nxt = i + 1 < n ? source[i + 1] : '';
      if (nxt.length === 0 || /[\t\f\r\n ]/.test(nxt) || !/[0-9A-Fa-f]/.test(nxt)) {
        return true;
      }
    }
    i += 1;
  }
  return false;
}

/** Old servers may pretty-print only comment-free buffers. New servers always may. */
export function allowDocumentFormat(source: string, preservesComments: boolean): boolean {
  return preservesComments || !hasDroppableComments(source);
}
