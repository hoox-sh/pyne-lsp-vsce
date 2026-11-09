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

import { execFile } from 'child_process';
import * as path from 'path';
import { cfg } from './config';
import { resolveLspLaunch } from './lsp';

export type ConvertToV6Payload = {
  source?: string;
  from_version?: number;
  changed?: boolean;
};

export { convertSuccessMessage } from './messages';

/** True for python / python3 / py, with or without a Windows `.exe` suffix. */
function isPythonInterpreter(command: string): boolean {
  const base = path.basename(command).toLowerCase();
  return (
    base === 'python' ||
    base === 'python.exe' ||
    base === 'python3' ||
    base === 'python3.exe' ||
    base === 'py' ||
    base === 'py.exe'
  );
}

export async function convertViaPython(source: string): Promise<string> {
  const launch = resolveLspLaunch();
  const python = isPythonInterpreter(launch.command)
    ? launch.command
    : (cfg<string>('lsp.python') || 'python3').trim() || 'python3';
  const script =
    'from pynescript.util.pine_convert import convert_to_v6\n' +
    'import sys\n' +
    'sys.stdout.write(convert_to_v6(sys.stdin.read()))\n';
  return new Promise((resolve, reject) => {
    const child = execFile(
      python,
      ['-c', script],
      { encoding: 'utf8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          const msg = err.message;
          reject(
            new Error(`Need Python with hoox-pyne installed (pip install hoox-pyne). ${msg}`),
          );
          return;
        }
        resolve(typeof stdout === 'string' ? stdout : String(stdout));
      },
    );
    child.stdin?.write(source);
    child.stdin?.end();
  });
}
