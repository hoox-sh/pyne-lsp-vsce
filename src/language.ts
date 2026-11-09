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
 * Pack language surface.
 *
 * AXIS menus/keybindings match `editorLangId == pinescript` (see
 * axis-ide-vsce/package.json). PYNE therefore owns a **single** language id
 * `pinescript` for `.pyne` / `.pine` / related suffixes so those `when`
 * clauses fire. `pine` and `pyne` are accepted as incoming ids (PyneIDE or
 * a manual language mode) and normalized to `pinescript`.
 *
 * Do not register a second language id for the same extensions — AXIS would
 * miss those buffers.
 */

export const PINE_LANGUAGE_ID = 'pinescript';

/** Incoming ids we treat as Pine/PYNE source (canonical id is `pinescript`). */
export const PINE_LANGUAGE_IDS = ['pinescript', 'pine', 'pyne'] as const;

/** Filename suffixes contributed as Pine/PYNE source. Keep in sync with package.json. */
export const PINE_FILE_SUFFIXES = [
  '.pyne',
  '.pine',
  '.pinev5',
  '.pinev6',
  '.pinescript',
  '.psc',
] as const;

export const AXIS_IDE_EXTENSION_ID = 'hoox-sh.axis-ide';
export const AXIS_RUN_SCRIPT_COMMAND = 'axis.runScript';

export function isPineLanguageId(languageId: string): boolean {
  return (PINE_LANGUAGE_IDS as readonly string[]).includes(languageId);
}

export function isPineFilePath(filePath: string): boolean {
  const base = filePath.toLowerCase().replace(/\\/g, '/').split('/').pop() ?? '';
  return PINE_FILE_SUFFIXES.some((ext) => base.endsWith(ext));
}

export function isPineDocument(doc: {
  languageId: string;
  fileName?: string;
  uri?: { fsPath?: string; path?: string };
}): boolean {
  if (isPineLanguageId(doc.languageId)) {
    return true;
  }
  const path = doc.fileName || doc.uri?.fsPath || doc.uri?.path || '';
  return isPineFilePath(path);
}

/** True when the buffer should be forced to `pinescript` so AXIS `when` matches. */
export function shouldNormalizeToPinescript(languageId: string, filePath: string): boolean {
  if (languageId === PINE_LANGUAGE_ID) {
    return false;
  }
  return isPineLanguageId(languageId) || isPineFilePath(filePath);
}
