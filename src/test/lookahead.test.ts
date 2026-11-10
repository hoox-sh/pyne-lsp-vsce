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
import { scanPineLookahead } from '../lookahead';

describe('scanPineLookahead', () => {
  it('flags request.security and ignores comments', () => {
    const hot = scanPineLookahead('request.security(syminfo.tickerid, "D", close)\n');
    assert.equal(hot.tainted, true);
    assert.equal(hot.static, true);
    const cold = scanPineLookahead('// request.security(syminfo.tickerid, "D", close)\nplot(close)\n');
    assert.equal(cold.tainted, false);
  });

  it('keeps the column after a line comment above the hit', () => {
    const report = scanPineLookahead('// note\nrequest.security(syminfo.tickerid, "D", close)\n');
    assert.equal(report.hits.length, 1);
    assert.equal(report.hits[0].line, 1);
    assert.equal(report.hits[0].col, 0);
    assert.equal(report.hits[0].kind, 'security');
  });

  it('does not flag request.security inside a string', () => {
    const report = scanPineLookahead('x = "request.security("\nplot(close)\n');
    assert.equal(report.tainted, false);
  });
});
