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
import { findUrlOnLine } from '../links';

describe('findUrlOnLine', () => {
  const line = '// Docs: https://hoox.sh/pyne and https://example.com/a.';

  it('uses the column on the line, including lines that are not the first', () => {
    const start = line.indexOf('https://hoox.sh');
    assert.equal(findUrlOnLine(line, start + 8), 'https://hoox.sh/pyne');
    assert.equal(findUrlOnLine(line, 2), undefined);
  });

  it('drops trailing punctuation from the URL', () => {
    const start = line.indexOf('https://example.com');
    assert.equal(findUrlOnLine(line, start + 4), 'https://example.com/a');
  });
});
