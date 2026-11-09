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

/** SecretStorage slot — never a `contributes.configuration` key. */
export const PRO_SECRET_SLOT = 'pynescript.secret.proApiKey';

/** Legacy plaintext setting removed in Wave 1; still read once for migration. */
export const LEGACY_PRO_KEY_SETTING = 'pro.apiKey';

export const PRO_KEY_STORE_ERROR = 'PYNE SecretStorage operation failed';
export const PRO_KEY_SHAPE_ERROR = 'PYNE Pro key must be a single non-empty line';

export type SecretStore = {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
};

export type SecretResult = { ok: true } | { ok: false; error: string };

export function createMemorySecretStore(
  initial?: Iterable<[string, string]>,
): SecretStore & { readonly map: Map<string, string> } {
  const map = new Map<string, string>(initial);
  return {
    map,
    get(key: string): Thenable<string | undefined> {
      return Promise.resolve(map.get(key));
    },
    store(key: string, value: string): Thenable<void> {
      map.set(key, value);
      return Promise.resolve();
    },
    delete(key: string): Thenable<void> {
      map.delete(key);
      return Promise.resolve();
    },
  };
}

function trimOrNull(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return raw.trim();
}

function shapeOk(value: string): boolean {
  return value.length > 0 && value.length <= 1024 && !/[\r\n]/.test(value);
}

export async function getProKey(store: SecretStore): Promise<string | undefined> {
  try {
    const v = await store.get(PRO_SECRET_SLOT);
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t || undefined;
  } catch {
    return undefined;
  }
}

/** Store a Pro key, or delete the slot when `raw` trims empty. */
export async function setProKey(store: SecretStore, raw: unknown): Promise<SecretResult> {
  const v = trimOrNull(raw);
  if (v === null) return { ok: false, error: PRO_KEY_SHAPE_ERROR };
  try {
    if (!v) {
      await store.delete(PRO_SECRET_SLOT);
      return { ok: true };
    }
    if (!shapeOk(v)) return { ok: false, error: PRO_KEY_SHAPE_ERROR };
    await store.store(PRO_SECRET_SLOT, v);
    return { ok: true };
  } catch {
    return { ok: false, error: PRO_KEY_STORE_ERROR };
  }
}

export async function clearProKey(store: SecretStore): Promise<SecretResult> {
  try {
    await store.delete(PRO_SECRET_SLOT);
    return { ok: true };
  } catch {
    return { ok: false, error: PRO_KEY_STORE_ERROR };
  }
}

/**
 * One-time move from leftover `pynescript.pro.apiKey` settings into SecretStorage.
 * `clearLegacy` must wipe Global / Workspace / Folder values.
 */
export async function migrateLegacyProKey(
  store: SecretStore,
  legacy: string | undefined,
  clearLegacy: () => Promise<void>,
): Promise<'moved' | 'cleared' | 'none'> {
  const leftover = typeof legacy === 'string' ? legacy.trim() : '';
  if (!leftover) return 'none';
  const existing = await getProKey(store);
  if (!existing && shapeOk(leftover)) {
    const stored = await setProKey(store, leftover);
    if (!stored.ok) return 'none';
    await clearLegacy();
    return 'moved';
  }
  await clearLegacy();
  return 'cleared';
}
