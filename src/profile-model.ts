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
 * Run-profile model for the editor line profiler.
 *
 * Ported from AXIS `results/profiler.ts` so the extension accepts the same
 * loose payloads the Pro `/run` endpoint and engines emit. Keep this module
 * free of `vscode` imports so it stays unit-testable.
 */

/** Per-line timing / exec stats (1-based line numbers). */
export interface ProfileLineStat {
  /** 1-based source line. */
  line: number;
  /** Cumulative time spent on this line (milliseconds). */
  ms: number;
  /** How many times this line executed. */
  execs: number;
  /** Share of total line time (0–100), recomputed from Σ ms. */
  pct: number;
}

/** Full profiler snapshot for one script run. */
export interface RunProfile {
  totalMs?: number;
  bars?: number;
  mode?: string;
  phases?: Record<string, number>;
  lines: ProfileLineStat[];
  runId?: string;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asLineNumber(value: unknown): number | null {
  const n = finiteNumber(value);
  if (n == null) return null;
  const line = Math.trunc(n);
  return line >= 1 ? line : null;
}

function readPhases(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const phases: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = finiteNumber(raw);
    if (n != null) phases[key] = n;
  }
  return Object.keys(phases).length ? phases : undefined;
}

function unwrapProfile(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const record = raw as Record<string, unknown>;
  for (const key of ['profile', 'runProfile']) {
    const nested = record[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested;
    }
  }
  const meta = record['meta'];
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const nested = (meta as Record<string, unknown>)['profile'];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested;
    }
  }
  return raw;
}

function readLineRows(body: unknown): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }
  if (!body || typeof body !== 'object') {
    return [];
  }
  const record = body as Record<string, unknown>;
  for (const key of ['lines', 'line_stats', 'lineStats', 'stats', 'by_line', 'byLine']) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object') {
      return Object.entries(candidate as Record<string, unknown>).map(([line, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return { line: Number(line), ...(value as object) };
        }
        return { line: Number(line), ms: value };
      });
    }
  }
  return [];
}

function readStat(row: unknown): { line: number; ms: number; execs: number } | null {
  if (Array.isArray(row)) {
    const line = asLineNumber(row[0]);
    if (line == null) return null;
    return {
      line,
      ms: Math.max(0, finiteNumber(row[1]) ?? 0),
      execs: Math.max(0, Math.trunc(finiteNumber(row[2]) ?? 0)),
    };
  }
  if (!row || typeof row !== 'object') {
    return null;
  }
  const record = row as Record<string, unknown>;
  const line = asLineNumber(
    record['line'] ?? record['line_no'] ?? record['lineNo'] ?? record['lineno'] ?? record['ln'],
  );
  if (line == null) return null;
  return {
    line,
    ms: Math.max(
      0,
      finiteNumber(
        record['ms'] ??
          record['time_ms'] ??
          record['timeMs'] ??
          record['time'] ??
          record['elapsed_ms'] ??
          record['elapsedMs'],
      ) ?? 0,
    ),
    execs: Math.max(
      0,
      Math.trunc(
        finiteNumber(
          record['execs'] ??
            record['executions'] ??
            record['count'] ??
            record['calls'] ??
            record['n'] ??
            record['exec_count'] ??
            record['execCount'],
        ) ?? 0,
      ),
    ),
  };
}

/**
 * Normalize a loose runtime / API payload into a {@link RunProfile}.
 *
 * Accepts `{ profile }`, `{ meta: { profile } }`, `{ lines }`,
 * `{ line_stats }`, map form `{ "12": { ms, execs } }`, and tuple rows.
 * Returns `null` when neither line data nor total/phase timing is present.
 */
export function normalizeRunProfile(raw: unknown, fallbackTotalMs?: number): RunProfile | null {
  if (raw == null) {
    if (fallbackTotalMs != null && Number.isFinite(fallbackTotalMs) && fallbackTotalMs >= 0) {
      return { totalMs: fallbackTotalMs, lines: [] };
    }
    return null;
  }

  const body = unwrapProfile(raw);
  const record =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined;

  let totalMs: number | undefined;
  let bars: number | undefined;
  let mode: string | undefined;
  let runId: string | undefined;
  let phases: Record<string, number> | undefined;
  if (record) {
    const t = finiteNumber(
      record['totalMs'] ?? record['total_ms'] ?? record['totalTimeMs'] ?? record['total_time_ms'],
    );
    if (t != null && t >= 0) totalMs = t;
    const b = finiteNumber(record['bars'] ?? record['bar_count'] ?? record['count']);
    if (b != null && b >= 0) bars = Math.trunc(b);
    if (typeof record['mode'] === 'string') mode = record['mode'];
    if (typeof record['runId'] === 'string') runId = record['runId'];
    else if (typeof record['run_id'] === 'string') runId = record['run_id'];
    phases = readPhases(record['phases']);
  }

  const byLine = new Map<number, { ms: number; execs: number }>();
  for (const row of readLineRows(body)) {
    const stat = readStat(row);
    if (!stat) continue;
    const prev = byLine.get(stat.line);
    if (prev) {
      prev.ms += stat.ms;
      prev.execs += stat.execs;
    } else {
      byLine.set(stat.line, { ms: stat.ms, execs: stat.execs });
    }
  }

  let sumMs = 0;
  for (const stat of byLine.values()) sumMs += stat.ms;

  const lines: ProfileLineStat[] = [];
  for (const [line, stat] of byLine) {
    lines.push({
      line,
      ms: stat.ms,
      execs: stat.execs,
      pct: sumMs > 0 ? Math.max(0, (stat.ms / sumMs) * 100) : 0,
    });
  }
  lines.sort((a, b) => a.line - b.line);

  const resolvedTotal =
    totalMs ??
    (sumMs > 0 ? sumMs : undefined) ??
    (fallbackTotalMs != null && Number.isFinite(fallbackTotalMs) && fallbackTotalMs >= 0
      ? fallbackTotalMs
      : undefined);

  if (lines.length === 0 && resolvedTotal == null && !phases && bars == null) {
    return null;
  }

  return { totalMs: resolvedTotal, bars, mode, phases, lines, runId };
}

/** Map 1-based line number → stat, with `pct` recomputed from Σ ms. */
export function profileLineMap(
  profile: RunProfile | null | undefined,
): Map<number, ProfileLineStat> {
  const map = new Map<number, ProfileLineStat>();
  if (!profile?.lines?.length) return map;
  for (const row of profile.lines) {
    if (!row || row.line < 1) continue;
    const prev = map.get(row.line);
    if (prev) {
      prev.ms += row.ms;
      prev.execs += row.execs;
    } else {
      map.set(row.line, { ...row });
    }
  }
  let sum = 0;
  for (const stat of map.values()) sum += stat.ms;
  if (sum > 0) {
    for (const [line, stat] of map) {
      map.set(line, { ...stat, pct: (stat.ms / sum) * 100 });
    }
  }
  return map;
}

/**
 * Best-effort run total (ms) from a `/run` result envelope.
 *
 * Used as `fallbackTotalMs` so the hover can show a run total when the payload
 * reports `meta.ms` / `ms` but no per-profile total (AXIS parity).
 */
export function runTotalMs(raw: unknown): number | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const meta =
    rec['meta'] && typeof rec['meta'] === 'object' && !Array.isArray(rec['meta'])
      ? (rec['meta'] as Record<string, unknown>)
      : undefined;
  const n = finiteNumber(
    rec['ms'] ??
      rec['totalMs'] ??
      rec['total_ms'] ??
      meta?.['ms'] ??
      meta?.['totalMs'] ??
      meta?.['total_ms'],
  );
  return n != null && n >= 0 ? n : undefined;
}

/** Compact chip label: `12.3%`, `<0.1%`, or `0%`. */
export function formatPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  // Round before choosing the branch so 9.96 renders "10%", not "10.0%".
  const oneDecimal = Math.round(pct * 10) / 10;
  if (oneDecimal < 10) return `${oneDecimal.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

/** 1-based lines with the largest share, capped at *limit*. */
export function hottestLines(profile: RunProfile | null | undefined, limit = 3): Set<number> {
  const ranked = [...profileLineMap(profile).entries()]
    .filter(([, stat]) => stat.pct > 0 || stat.ms > 0)
    .sort((a, b) => {
      const dp = b[1].pct - a[1].pct;
      return dp !== 0 ? dp : b[1].ms - a[1].ms;
    })
    .slice(0, Math.max(0, limit));
  return new Set(ranked.map(([line]) => line));
}
