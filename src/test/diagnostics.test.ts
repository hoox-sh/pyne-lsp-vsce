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
import { diagnosticCodeText, filterDiagnostics } from '../diagnostics';

describe('filterDiagnostics', () => {
  it('reads a diagnostic code object', () => {
    assert.equal(diagnosticCodeText({ value: 'W001', target: 'https://example.test' }), 'W001');
    assert.equal(diagnosticCodeText('E001'), 'E001');
  });

  it('maps severity with the VS Code enum, not the LSP enum', () => {
    const [mapped] = filterDiagnostics([{ code: 'W001', severity: 1 }], {
      enabled: true,
      severity: { W: 'Hint' },
    });
    assert.equal(mapped.severity, 3);
    const [asError] = filterDiagnostics([{ code: { value: 'E001' }, severity: 0 }], {
      enabled: true,
      severity: { E: 'Error' },
    });
    assert.equal(asError.severity, 0);
  });

  it('drops every diagnostic when the feature is off', () => {
    assert.deepEqual(filterDiagnostics([{ code: 'E001', severity: 0 }], { enabled: false }), []);
  });
});
