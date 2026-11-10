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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowDocumentFormat,
  hasDroppableComments,
  legendFromCapabilities,
  legendPreservesComments,
  serverPreservesComments,
  serverVersionAtLeast,
} from '../format-guard';

const OLD_LEGEND = [
  'namespace',
  'type',
  'class',
  'function',
  'method',
  'variable',
  'parameter',
  'property',
  'keyword',
  'string',
  'number',
  'operator',
  'comment',
];

describe('legendPreservesComments', () => {
  it('requires the legend to end with series then simple', () => {
    assert.equal(legendPreservesComments(OLD_LEGEND), false);
    assert.equal(legendPreservesComments([...OLD_LEGEND, 'series', 'simple']), true);
    assert.equal(legendPreservesComments([...OLD_LEGEND, 'simple', 'series']), false);
    assert.equal(legendPreservesComments(undefined), false);
  });

  it('reads token types from initialize capabilities', () => {
    const types = legendFromCapabilities({
      semanticTokensProvider: { legend: { tokenTypes: [...OLD_LEGEND, 'series', 'simple'] } },
    });
    assert.equal(legendPreservesComments(types), true);
    assert.equal(legendFromCapabilities({ semanticTokensProvider: true }), undefined);
  });
});

describe('serverPreservesComments', () => {
  it('trusts an advertised series/simple tail or serverInfo 0.6.35+', () => {
    assert.equal(serverVersionAtLeast('0.6.35', '0.6.35'), true);
    assert.equal(serverVersionAtLeast('0.6.34', '0.6.35'), false);
    assert.equal(serverVersionAtLeast('0.7.0', '0.6.35'), true);
    assert.equal(serverVersionAtLeast('not-a-version', '0.6.35'), false);
    assert.equal(
      serverPreservesComments({ tokenTypes: [...OLD_LEGEND, 'series', 'simple'], version: '0.6.34' }),
      true,
    );
    assert.equal(serverPreservesComments({ tokenTypes: OLD_LEGEND, version: '0.6.35' }), true);
    assert.equal(serverPreservesComments({ tokenTypes: OLD_LEGEND, version: '0.6.34' }), false);
    assert.equal(serverPreservesComments({}), false);
  });
});

describe('allowDocumentFormat', () => {
  const commented = '//@version=6\n// note\nplot(close) // trail\n';
  const clean = '//@version=6\nplot(close)\n';

  it('formats comment-free buffers on every server', () => {
    assert.equal(hasDroppableComments(clean), false);
    assert.equal(allowDocumentFormat(clean, false), true);
    assert.equal(allowDocumentFormat(clean, true), true);
  });

  it('keeps the comment-free guard until the server preserves comments', () => {
    assert.equal(hasDroppableComments(commented), true);
    assert.equal(hasDroppableComments('plot(close) /* inline */\n'), true);
    assert.equal(hasDroppableComments('x = 1 # note\n'), true);
    assert.equal(hasDroppableComments('band = color.new(#5B6CFF, 20)\n'), false);
    assert.equal(allowDocumentFormat(commented, false), false);
    assert.equal(allowDocumentFormat(commented, true), true);
  });

  it('ignores comments inside strings', () => {
    assert.equal(hasDroppableComments('x = "not // a comment"\n'), false);
  });
});
