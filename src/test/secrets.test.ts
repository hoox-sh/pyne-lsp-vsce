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
  LEGACY_PRO_KEY_SETTING,
  PRO_KEY_SHAPE_ERROR,
  PRO_SECRET_SLOT,
  clearProKey,
  createMemorySecretStore,
  getProKey,
  migrateLegacyProKey,
  setProKey,
} from '../secrets';

describe('PYNE Pro SecretStorage', () => {
  it('stores, reads, and clears without returning the key on set', async () => {
    const store = createMemorySecretStore();
    const saved = await setProKey(store, '  pk_live_abc  ');
    assert.deepEqual(saved, { ok: true });
    assert.equal(await getProKey(store), 'pk_live_abc');
    assert.equal(store.map.get(PRO_SECRET_SLOT), 'pk_live_abc');
    const cleared = await setProKey(store, '   ');
    assert.deepEqual(cleared, { ok: true });
    assert.equal(await getProKey(store), undefined);
    await setProKey(store, 'again');
    assert.deepEqual(await clearProKey(store), { ok: true });
    assert.equal(await getProKey(store), undefined);
  });

  it('rejects non-strings, newlines, and overlong keys', async () => {
    const store = createMemorySecretStore();
    assert.deepEqual(await setProKey(store, 1 as unknown as string), {
      ok: false,
      error: PRO_KEY_SHAPE_ERROR,
    });
    assert.deepEqual(await setProKey(store, 'line\nbreak'), {
      ok: false,
      error: PRO_KEY_SHAPE_ERROR,
    });
    assert.equal((await setProKey(store, 'x'.repeat(1025))).ok, false);
    assert.equal(await getProKey(store), undefined);
  });

  it('migrates leftover plaintext then asks clearLegacy', async () => {
    const store = createMemorySecretStore();
    let cleared = 0;
    const moved = await migrateLegacyProKey(store, '  leftover-key  ', async () => {
      cleared += 1;
    });
    assert.equal(moved, 'moved');
    assert.equal(await getProKey(store), 'leftover-key');
    assert.equal(cleared, 1);
    const again = await migrateLegacyProKey(store, 'other', async () => {
      cleared += 1;
    });
    assert.equal(again, 'cleared');
    assert.equal(await getProKey(store), 'leftover-key');
    assert.equal(cleared, 2);
    assert.equal(await migrateLegacyProKey(store, '  ', async () => {
      cleared += 1;
    }), 'none');
    assert.equal(cleared, 2);
    assert.equal(LEGACY_PRO_KEY_SETTING, 'pro.apiKey');
  });
});
