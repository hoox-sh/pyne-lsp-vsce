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
 * Per-line profiler decorations for Pine editors.
 *
 * Mirrors AXIS's profiler gutter: a compact `%` chip at the start of each
 * profiled line (VS Code has no gutter-decoration API, so the chip is an inline
 * `before` decoration at column 0), a hot-line accent for the top three lines,
 * and a hover card (kind chip, then ms / execs / share). Profile data comes from the Pro
 * `/run` endpoint when `pynescript.profiler.enabled` is on and the request
 * sends `profiler: true`.
 */

import {
  commands,
  ConfigurationTarget,
  DecorationRangeBehavior,
  MarkdownString,
  OverviewRulerLane,
  Range,
  ThemeColor,
  window,
  workspace,
  type DecorationOptions,
  type ExtensionContext,
  type TextEditor,
  type TextEditorDecorationType,
} from 'vscode';
import { COMMANDS } from './commands';
import { cfg } from './config';
import { decorateHoverMarkdown } from './hover-card';
import { isPineDocument } from './language';
import { log, logDebug } from './log';
import {
  formatPct,
  hottestLines,
  normalizeRunProfile,
  profileLineMap,
  runTotalMs,
  type RunProfile,
} from './profile-model';

let chipType: TextEditorDecorationType | undefined;
let hotLineType: TextEditorDecorationType | undefined;
let coolLineType: TextEditorDecorationType | undefined;
let currentProfile: RunProfile | undefined;
let currentDoc: string | undefined;
let profiledEditor: TextEditor | undefined;

export function profilerEnabled(): boolean {
  return cfg<boolean>('profiler.enabled') === true;
}

function ensureDecorationTypes(): void {
  chipType ??= window.createTextEditorDecorationType({
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    before: {
      margin: '0 0.55em 0 0',
      fontStyle: 'normal',
      fontWeight: '500',
      textDecoration: 'none',
    },
  });
  hotLineType ??= window.createTextEditorDecorationType({
    isWholeLine: true,
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    backgroundColor: 'rgba(255, 180, 84, 0.07)',
    overviewRulerColor: 'rgba(255, 180, 84, 0.75)',
    overviewRulerLane: OverviewRulerLane.Right,
  });
  coolLineType ??= window.createTextEditorDecorationType({
    isWholeLine: true,
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    backgroundColor: 'rgba(147, 159, 255, 0.05)',
    overviewRulerColor: 'rgba(147, 159, 255, 0.55)',
    overviewRulerLane: OverviewRulerLane.Right,
  });
}

function clearEditor(editor: TextEditor | undefined): void {
  if (!editor || !chipType || !hotLineType || !coolLineType) {
    return;
  }
  editor.setDecorations(chipType, []);
  editor.setDecorations(hotLineType, []);
  editor.setDecorations(coolLineType, []);
}

/** Remove the active profile and every rendered decoration. */
export function clearProfile(showMessage = true): void {
  clearEditor(profiledEditor);
  currentProfile = undefined;
  currentDoc = undefined;
  profiledEditor = undefined;
  if (showMessage) {
    void window.showInformationMessage('PYNE line profile cleared.');
  }
}

function hoverFor(lineNo: number, stat: { ms: number; execs: number; pct: number }): MarkdownString {
  const lines = [
    '`profile`',
    '',
    `**${lineNo}**`,
    `${stat.ms.toFixed(1)} ms`,
    `${Math.trunc(stat.execs)} execs`,
    `${stat.pct.toFixed(1)}% share`,
  ];
  const context: string[] = [];
  if (currentProfile?.totalMs != null) {
    context.push(`${currentProfile.totalMs.toFixed(1)} ms run`);
  }
  if (currentProfile?.bars != null) {
    context.push(`${currentProfile.bars} ${currentProfile.bars === 1 ? 'bar' : 'bars'}`);
  }
  if (currentProfile?.mode) {
    context.push(currentProfile.mode);
  }
  if (context.length) {
    lines.push('', context.join(' · '));
  }
  const phases = Object.entries(currentProfile?.phases ?? {})
    .filter(([, ms]) => ms > 0)
    .map(([key, ms]) => `${key.replace(/_ms$/, '')} ${ms.toFixed(1)} ms`)
    .join(' · ');
  if (phases) {
    lines.push('', phases);
  }
  const card = lines.join('\n');
  const md = new MarkdownString(decorateHoverMarkdown(card) ?? card, true);
  md.isTrusted = false;
  return md;
}

/** Render the active profile into *editor*. Returns the number of painted lines. */
function render(editor: TextEditor): number {
  if (!currentProfile || !chipType || !hotLineType || !coolLineType) {
    return 0;
  }
  if (editor.document.uri.toString() !== currentDoc) {
    return 0;
  }
  const map = profileLineMap(currentProfile);
  if (map.size === 0) {
    clearEditor(editor);
    return 0;
  }
  const hot = hottestLines(currentProfile);
  const chips: DecorationOptions[] = [];
  const hotLines: DecorationOptions[] = [];
  const coolLines: DecorationOptions[] = [];
  const doc = editor.document;

  for (const [lineNo, stat] of map) {
    if (lineNo < 1 || lineNo > doc.lineCount) continue;
    if (!(stat.ms > 0 || stat.execs > 0 || stat.pct > 0)) continue;
    const line = doc.lineAt(lineNo - 1);
    const range = new Range(line.lineNumber - 1, 0, line.lineNumber - 1, 0);
    const isHot = hot.has(lineNo);
    const hover = hoverFor(lineNo, stat);
    chips.push({
      range,
      hoverMessage: hover,
      renderOptions: {
        before: {
          contentText: `${formatPct(stat.pct)} `,
          color: isHot
            ? new ThemeColor('editorWarning.foreground')
            : new ThemeColor('editorCodeLens.foreground'),
          backgroundColor: isHot
            ? 'rgba(255, 180, 84, 0.24)'
            : 'rgba(147, 159, 255, 0.18)',
          fontWeight: isHot ? '600' : '400',
        },
      },
    });
    (isHot ? hotLines : coolLines).push({ range, hoverMessage: hover });
  }

  editor.setDecorations(chipType, chips);
  editor.setDecorations(hotLineType, hotLines);
  editor.setDecorations(coolLineType, coolLines);
  return chips.length;
}

/** Why a `/run` payload did or did not reach the editor. */
export type ProfileApplyReason =
  | 'profiler-off'
  | 'not-pine'
  | 'stale-document'
  | 'no-line-data';

export interface ProfileApplyResult {
  /** Number of lines actually painted (0 when nothing was applied). */
  applied: number;
  /** Set when `applied` is 0. */
  reason?: ProfileApplyReason;
}

export interface ApplyProfileOptions {
  /**
   * Clear the painted profile when the payload has no usable line data
   * (default `true`). Failure responses usually carry no profile at all; pass
   * `false` there so a transient error keeps chips that still match the buffer.
   */
  clearOnEmpty?: boolean;
}

/**
 * Apply a `/run` payload to *editor*.
 *
 * `expectedVersion` guards against line drift: if the document changed while
 * the request was in flight, the profile is discarded rather than painted on
 * the wrong lines (the edit itself already cleared any painted profile). A
 * successful payload that yields nothing usable also clears whatever was
 * painted before, so a data-less run never leaves stale chips behind. Returns
 * how many lines were painted, plus the reason when none were.
 */
export function applyProfileToEditor(
  editor: TextEditor,
  raw: unknown,
  expectedVersion?: number,
  options: ApplyProfileOptions = {},
): ProfileApplyResult {
  if (!profilerEnabled()) {
    return { applied: 0, reason: 'profiler-off' };
  }
  if (!isPineDocument(editor.document)) {
    return { applied: 0, reason: 'not-pine' };
  }
  if (expectedVersion !== undefined && editor.document.version !== expectedVersion) {
    // Do not clear here: the edit already cleared the painted profile, and any
    // profile present now came from a newer run that must survive this stale
    // response.
    logDebug('Profiler result discarded: document changed during /run.');
    return { applied: 0, reason: 'stale-document' };
  }
  const profile = normalizeRunProfile(raw, runTotalMs(raw));
  if (!profile || profile.lines.length === 0) {
    logDebug('Profiler result has no per-line data.');
    if (options.clearOnEmpty !== false) clearProfile(false);
    return { applied: 0, reason: 'no-line-data' };
  }
  ensureDecorationTypes();
  clearEditor(profiledEditor);
  currentProfile = profile;
  currentDoc = editor.document.uri.toString();
  profiledEditor = editor;
  const painted = render(editor);
  if (painted === 0) {
    // Rows exist but every one cost 0 ms / 0 execs: nothing to draw.
    logDebug('Profiler rows carry no measurable cost; nothing painted.');
    if (options.clearOnEmpty !== false) clearProfile(false);
    return { applied: 0, reason: 'no-line-data' };
  }
  log(
    `Line profile applied: ${painted} line(s)` +
      (profile.totalMs != null ? `, ${profile.totalMs.toFixed(1)} ms total` : '') +
      (profile.mode ? `, mode ${profile.mode}` : '') +
      '.',
  );
  return { applied: painted };
}

/** Toggle the profiler setting; turning it off clears the painted chips. */
export async function toggleProfiler(): Promise<void> {
  const next = !profilerEnabled();
  await workspace
    .getConfiguration('pynescript')
    .update('profiler.enabled', next, ConfigurationTarget.Global);
  if (!next) {
    clearProfile(false);
    void window.showInformationMessage('PYNE line profiler off.');
    return;
  }
  void window.showInformationMessage(
    'PYNE line profiler on. Run “PYNE: Smoke /run (one bar)” to collect per-line timings.',
  );
}

/** Register the profiler commands, listeners, and decoration types. */
export function registerProfiler(context: ExtensionContext): void {
  ensureDecorationTypes();
  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleProfiler, () => toggleProfiler()),
    commands.registerCommand(COMMANDS.clearProfile, () => clearProfile()),
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor && currentDoc === editor.document.uri.toString() && profilerEnabled()) {
        render(editor);
        profiledEditor = editor;
      } else if (profiledEditor && profiledEditor !== editor) {
        clearEditor(profiledEditor);
      }
    }),
    workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== currentDoc) {
        return;
      }
      // Any edit invalidates the mapping: tracked decorations would drift with
      // the text while the stored line numbers no longer describe the buffer,
      // so drop the profile instead of showing it against the wrong lines.
      logDebug('Line profile cleared: the document changed after the run.');
      clearProfile(false);
    }),
    workspace.onDidCloseTextDocument((document) => {
      if (document.uri.toString() === currentDoc) {
        clearProfile(false);
      }
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('pynescript.profiler.enabled')) {
        return;
      }
      // Enabling cannot restore anything: the profile is cleared on disable.
      if (!profilerEnabled()) {
        clearProfile(false);
      }
    }),
    {
      dispose: () => {
        clearEditor(profiledEditor);
        chipType?.dispose();
        hotLineType?.dispose();
        coolLineType?.dispose();
        chipType = undefined;
        hotLineType = undefined;
        coolLineType = undefined;
        currentProfile = undefined;
        currentDoc = undefined;
        profiledEditor = undefined;
      },
    },
  );
}
