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
import { KIND_ICONS, decorateHoverMarkdown } from '../hover-card';

describe('decorateHoverMarkdown', () => {
  it('prefixes a known kind chip with its codicon', () => {
    const card = '`function`\n\n```pinescript\nta.sma(close, 14)\n```\n';
    assert.equal(decorateHoverMarkdown(card), `$(symbol-function) ${card}`);
  });

  it('maps every kind in the shared vocabulary', () => {
    for (const [kind, icon] of Object.entries(KIND_ICONS)) {
      const card = `\`${kind}\`\n\nBody`;
      assert.equal(decorateHoverMarkdown(card), `$(${icon}) \`${kind}\`\n\nBody`);
    }
  });

  it('leaves an unknown kind untouched', () => {
    assert.equal(decorateHoverMarkdown('`mystery`\n\nBody'), undefined);
  });

  it('leaves markdown without a leading chip untouched', () => {
    assert.equal(decorateHoverMarkdown('**Bold**\n\nBody'), undefined);
    assert.equal(decorateHoverMarkdown('Body\n\n`function`'), undefined);
    assert.equal(decorateHoverMarkdown(''), undefined);
  });

  it('does not double-prefix an already decorated card', () => {
    const card = '`function`\n\nBody';
    const once = decorateHoverMarkdown(card);
    assert.equal(once, '$(symbol-function) `function`\n\nBody');
    assert.equal(decorateHoverMarkdown(once ?? ''), undefined);
    assert.equal(decorateHoverMarkdown('$(symbol-method) `function`\n'), undefined);
    assert.equal(decorateHoverMarkdown('$(pulse) `profile`\n\n4.0 ms'), undefined);
  });

  it('keeps the rest of the card byte-for-byte', () => {
    const tail =
      '\n\n```pinescript\nta.sma(close, 14)\n```\n\n---\n[Pine v6](https://example.test)\n';
    assert.equal(
      decorateHoverMarkdown(`\`namespace\`${tail}`),
      `$(symbol-namespace) \`namespace\`${tail}`,
    );
  });
});
