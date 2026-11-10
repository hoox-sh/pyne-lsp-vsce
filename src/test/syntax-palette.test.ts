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
import { resolveSyntaxInjection } from '../syntax-palette';

describe('resolveSyntaxInjection', () => {
  it('injects the default void palette on a non-PYNE theme', () => {
    assert.equal(resolveSyntaxInjection(undefined, 'Default Dark Modern'), 'void');
  });

  it('does not inject when the workbench theme already ships that palette', () => {
    assert.equal(resolveSyntaxInjection('void', 'AXIS Void'), 'none');
    assert.equal(resolveSyntaxInjection('signal', 'Hoox Signal'), 'none');
  });

  it('does not paint the dark void default onto AXIS Day', () => {
    assert.equal(resolveSyntaxInjection('void', 'AXIS Day'), 'none');
    assert.equal(resolveSyntaxInjection('signal', 'AXIS Day'), 'signal');
  });

  it('keeps an explicit none', () => {
    assert.equal(resolveSyntaxInjection('none', 'Default Dark Modern'), 'none');
  });
});
