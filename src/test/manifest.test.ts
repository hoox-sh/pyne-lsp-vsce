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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import {
  isPineDocument,
  isPineFilePath,
  isPineLanguageId,
  PINE_FILE_SUFFIXES,
  PINE_LANGUAGE_ID,
  shouldNormalizeToPinescript,
} from '../language';
import { convertSuccessMessage, summarizeSmokeResult } from '../messages';

const EXT_ROOT = path.resolve(__dirname, '../../');
const PACKAGE_PATH = path.join(EXT_ROOT, 'package.json');
const SNIPPETS_PATH = path.join(EXT_ROOT, 'snippets', 'pine.code-snippets');

const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

const EXPECTED_COMMANDS = [
  'pynescript.restartServer',
  'pynescript.formatDocument',
  'pynescript.showLspOutput',
  'pynescript.showLspCommand',
  'pynescript.showStatus',
  'pynescript.convertToV6',
  'pynescript.diagnosticsToggle',
  'pynescript.completionToggle',
  'pynescript.inlayHintsToggle',
  'pynescript.foldingToggle',
  'pynescript.colorPreviewToggle',
  'pynescript.toggleHover',
  'pynescript.toggleSignatureHelp',
  'pynescript.toggleSemanticTokens',
  'pynescript.toggleDocumentHighlight',
  'pynescript.toggleLinkedEditing',
  'pynescript.toggleSelectionRange',
  'pynescript.toggleDocumentLink',
  'pynescript.toggleCodeAction',
  'pynescript.toggleFormatOnSave',
  'pynescript.openDocumentLink',
  'pynescript.runOnPro',
  'pynescript.installLanguageServer',
  'pynescript.installBackend',
  'pynescript.startBackend',
  'pynescript.testBackend',
  'pynescript.selectSyntax',
  'pynescript.secrets.setProKey',
  'pynescript.secrets.clearProKey',
];

interface CommandContribution {
  command: string;
  title?: string;
  category?: string;
  description?: string;
  enablement?: string;
}

interface MenuEntry {
  command: string;
}

interface SnippetEntry {
  prefix?: string | string[];
}

describe('package identity', () => {
  it('has the Marketplace identity', () => {
    assert.equal(pkg.name, 'pyne');
    assert.equal(pkg.publisher, 'hoox-sh');
    assert.equal(pkg.displayName, 'PYNE Language Support');
    assert.ok(String(pkg.version).startsWith('0.5'), `unexpected version ${pkg.version}`);
  });
});

describe('commands', () => {
  const commands = pkg.contributes.commands as CommandContribution[];
  const commandIds = commands.map((c) => c.command);

  it('contributes every expected command id', () => {
    for (const id of EXPECTED_COMMANDS) {
      assert.ok(commandIds.includes(id), `missing command: ${id}`);
    }
    assert.ok(!commandIds.includes('pynescript.selectTheme'), 'selectTheme must not be contributed');
  });

  it('contributes selectSyntax', () => {
    const entry = commands.find((c) => c.command === 'pynescript.selectSyntax');
    assert.ok(entry, 'pynescript.selectSyntax is not in contributes.commands');
    assert.equal(entry.title, 'Select Syntax Highlighting');
    assert.equal(entry.category, 'PYNE');
    assert.equal(
      entry.description,
      'Choose AXIS Void, Hoox Signal, PYNE Volt, or inherit the active theme',
    );
  });

  it('has no duplicate command ids', () => {
    assert.equal(new Set(commandIds).size, commandIds.length, 'duplicate command id');
  });

  it('gives every command a real description', () => {
    for (const c of commands) {
      assert.ok(c.description && c.description.trim().length > 0, `${c.command} missing description`);
      assert.notEqual(
        c.description,
        `${c.title} command`,
        `${c.command} still has a generic description`,
      );
    }
  });

  it('lists every commandPalette entry in contributes.commands', () => {
    const palette = (pkg.contributes.menus?.commandPalette ?? []) as MenuEntry[];
    for (const entry of palette) {
      assert.ok(commandIds.includes(entry.command), `palette ${entry.command} is not contributed`);
    }
  });

  it('lists every editor/context command in contributes.commands', () => {
    const ctx = (pkg.contributes.menus?.['editor/context'] ?? []) as MenuEntry[];
    for (const entry of ctx) {
      assert.ok(commandIds.includes(entry.command), `context ${entry.command} is not contributed`);
    }
  });
});

describe('settings', () => {
  it('has no duplicate setting keys', () => {
    const configuration = Array.isArray(pkg.contributes.configuration)
      ? pkg.contributes.configuration
      : [pkg.contributes.configuration];
    const keys = configuration.flatMap((group: { properties?: Record<string, unknown> }) =>
      Object.keys(group.properties ?? {}),
    );
    assert.equal(new Set(keys).size, keys.length, 'duplicate setting key');
  });

  it('does not contribute pynescript.pro.apiKey (SecretStorage only)', () => {
    const configuration = Array.isArray(pkg.contributes.configuration)
      ? pkg.contributes.configuration
      : [pkg.contributes.configuration];
    const keys = configuration.flatMap((group: { properties?: Record<string, unknown> }) =>
      Object.keys(group.properties ?? {}),
    );
    assert.ok(!keys.includes('pynescript.pro.apiKey'), 'apiKey must not be a configuration property');
    const blob = JSON.stringify(pkg.contributes.configuration);
    assert.ok(!blob.includes('apiKey'), 'contributes.configuration must not mention apiKey');
  });

  it('does not mention the removed pynescript.theme setting', () => {
    const appearance = (pkg.contributes.configuration as Array<{ properties?: Record<string, { markdownDescription?: string }> }>)
      .flatMap((group) => Object.values(group.properties ?? {}));
    for (const setting of appearance) {
      const text = setting.markdownDescription ?? '';
      assert.ok(!text.includes('pynescript.theme'), 'leftover pynescript.theme mention');
    }
  });
});

describe('MCP and new language features', () => {
  it('registers the PYNE MCP server provider and activates at startup', () => {
    const providers = pkg.contributes.mcpServerDefinitionProviders as Array<{
      id: string;
      label?: string;
    }>;
    assert.ok(Array.isArray(providers), 'mcpServerDefinitionProviders contribution');
    assert.ok(
      providers.some((provider) => provider.id === 'pynescript.mcp'),
      'missing pynescript.mcp provider',
    );
    const events = pkg.activationEvents as string[];
    assert.ok(events.includes('onStartupFinished'), 'MCP provider needs activation at startup');
  });

  it('defaults code lenses on, inline completion off, and MCP on', () => {
    const configuration = Array.isArray(pkg.contributes.configuration)
      ? pkg.contributes.configuration
      : [pkg.contributes.configuration];
    const props = Object.assign(
      {},
      ...configuration.map(
        (group: { properties?: Record<string, { default?: unknown }> }) => group.properties ?? {},
      ),
    ) as Record<string, { default?: unknown }>;
    assert.equal(props['pynescript.codeLens.enabled']?.default, true);
    assert.equal(props['pynescript.inlineCompletion.enabled']?.default, false);
    assert.equal(props['pynescript.mcp.enabled']?.default, true);
    assert.equal(props['pynescript.mcp.command']?.default, 'auto');
  });

  it('targets a VS Code version with the MCP provider API', () => {
    const engine = String(pkg.engines.vscode);
    const minor = Number(engine.replace(/[^0-9.]/g, '').split('.')[1]);
    assert.ok(minor >= 102, `engines.vscode ${engine} needs >= 1.102`);
  });
});

describe('snippets', () => {
  it('parses and includes indicator, strategy, and library', () => {
    const snippets = JSON.parse(fs.readFileSync(SNIPPETS_PATH, 'utf8')) as Record<string, SnippetEntry>;
    const prefixes = Object.values(snippets).flatMap((s) =>
      Array.isArray(s.prefix) ? s.prefix : s.prefix ? [s.prefix] : [],
    );
    assert.ok(prefixes.includes('indicator'), 'missing indicator snippet');
    assert.ok(prefixes.includes('strategy'), 'missing strategy snippet');
    assert.ok(prefixes.includes('library'), 'missing library snippet');
    const body = JSON.stringify(snippets);
    assert.ok(body.includes('minval='), 'input snippets must use minval=');
    assert.ok(!body.includes('min=${'), 'input snippets must not use min=');
    assert.ok(body.includes('label.style_'), 'label.new uses label.style_* constants');
    assert.ok(body.includes('lookahead_off'), 'request.security snippet should default lookahead off');
  });
});

describe('language', () => {
  it('maps the expected file extensions onto a single pinescript id', () => {
    const langs = pkg.contributes.languages as Array<{
      id: string;
      extensions: string[];
      aliases?: string[];
      firstLine?: string;
    }>;
    assert.equal(langs.length, 1, 'must not split .pine / .pyne onto extra language ids');
    const lang = langs.find((l) => l.id === 'pinescript');
    assert.ok(lang, 'pinescript language contribution');
    for (const ext of PINE_FILE_SUFFIXES) {
      assert.ok(lang.extensions.includes(ext), `missing ${ext}`);
    }
    assert.ok(lang.aliases?.includes('pine'), 'alias pine');
    assert.ok(lang.aliases?.includes('pyne'), 'alias pyne');
    assert.ok(lang.firstLine, 'firstLine //@version=');
  });

  it('activates on .pinescript workspaces and onLanguage:pinescript', () => {
    const events = pkg.activationEvents as string[];
    assert.ok(events.includes('workspaceContains:**/*.pinescript'));
    assert.ok(events.includes('workspaceContains:**/*.psc'));
    assert.ok(events.includes('onLanguage:pinescript'));
  });

  it('turns pinescript inlay hints off by default', () => {
    const configuration = Array.isArray(pkg.contributes.configuration)
      ? pkg.contributes.configuration
      : [pkg.contributes.configuration];
    const props = Object.assign(
      {},
      ...configuration.map((group: { properties?: Record<string, { default?: unknown }> }) => group.properties ?? {}),
    ) as Record<string, { default?: unknown }>;
    const semantic = props['pynescript.diagnostics.semantic'] as { description?: string } | undefined;
    assert.match(semantic?.description ?? '', /S003/);
    assert.match(semantic?.description ?? '', /S004/);
    assert.equal(props['pynescript.inlayHints.parameters']?.default, false);
    const pine = pkg.contributes.configurationDefaults['[pinescript]'] as Record<string, unknown>;
    assert.equal(pine['editor.inlayHints.enabled'], 'off');
  });

  it('associates pack suffixes to pinescript for AXIS when-clauses', () => {
    const assoc = pkg.contributes.configurationDefaults['files.associations'] as Record<
      string,
      string
    >;
    for (const ext of PINE_FILE_SUFFIXES) {
      assert.equal(assoc[`*${ext}`], 'pinescript', `files.associations *${ext}`);
    }
  });

  it('contributes series/simple semantic token types and Format Document', () => {
    const types = (pkg.contributes.semanticTokenTypes ?? []) as Array<{ id: string }>;
    const ids = types.map((t) => t.id);
    assert.deepEqual(ids, ['series', 'simple'], 'legend tail the server appends');
    const commands = pkg.contributes.commands as CommandContribution[];
    const fmt = commands.find((c) => c.command === 'pynescript.formatDocument');
    assert.ok(fmt);
    assert.equal(fmt.enablement, 'editorLangId == pinescript');
  });

  it('does not contribute a second chart or debugger', () => {
    assert.equal(pkg.contributes.customEditors, undefined);
    assert.equal(pkg.contributes.debuggers, undefined);
    assert.equal(pkg.contributes.views, undefined);
  });
});

describe('pack language helpers', () => {
  it('treats pinescript as the canonical id', () => {
    assert.equal(PINE_LANGUAGE_ID, 'pinescript');
    assert.equal(isPineLanguageId('pinescript'), true);
    assert.equal(isPineLanguageId('pine'), true);
    assert.equal(isPineLanguageId('pyne'), true);
    assert.equal(isPineLanguageId('python'), false);
  });

  it('recognizes pack file suffixes', () => {
    assert.equal(isPineFilePath('/w/rsi.pyne'), true);
    assert.equal(isPineFilePath('/w/rsi.pine'), true);
    assert.equal(isPineFilePath('C:\\w\\rsi.psc'), true);
    assert.equal(isPineFilePath('/w/rsi.py'), false);
  });

  it('normalizes pine/pyne and suffix mismatches to pinescript', () => {
    assert.equal(shouldNormalizeToPinescript('pinescript', 'a.pine'), false);
    assert.equal(shouldNormalizeToPinescript('pine', 'a.pine'), true);
    assert.equal(shouldNormalizeToPinescript('python', 'a.pyne'), true);
    assert.equal(shouldNormalizeToPinescript('python', 'a.py'), false);
    assert.equal(isPineDocument({ languageId: 'pine', fileName: 'x.txt' }), true);
  });
});

describe('convert and smoke copy', () => {
  it('names the source version in the convert toast', () => {
    assert.match(convertSuccessMessage(5), /v5 → v6/);
    assert.match(convertSuccessMessage(4), /Undo/);
    assert.match(convertSuccessMessage(6), /Converted script to Pine v6/);
  });

  it('smoke copy never claims a chart', () => {
    const text = summarizeSmokeResult({ plots: [1, 2] });
    assert.match(text, /no chart/);
    assert.match(text, /AXIS: Run Script/);
    assert.match(text, /2 plot/);
    assert.doesNotMatch(text, /opened a chart/i);
  });
});

describe('command surface vs AXIS', () => {
  it('retitles runOnPro as a one-bar smoke, not a chart run', () => {
    const commands = pkg.contributes.commands as CommandContribution[];
    const run = commands.find((c) => c.command === 'pynescript.runOnPro');
    assert.ok(run);
    assert.equal(run.title, 'Smoke /run (one bar)');
    assert.match(String(run.description), /not a chart/i);
  });

  it('shows smoke /run on pinescript without requiring pro.enabled', () => {
    const palette = pkg.contributes.menus.commandPalette as Array<{ command: string; when?: string }>;
    const run = palette.find((e) => e.command === 'pynescript.runOnPro');
    assert.equal(run?.when, 'editorLangId == pinescript');
  });

  it('hides Start Backend when hosted mode is on', () => {
    const palette = pkg.contributes.menus.commandPalette as Array<{ command: string; when?: string }>;
    const start = palette.find((e) => e.command === 'pynescript.startBackend');
    assert.equal(start?.when, '!config.pynescript.backend.useHosted');
  });
});

describe('Extension Development Host', () => {
  it('ships extensionHost launch configs', () => {
    const launchPath = path.join(EXT_ROOT, '.vscode', 'launch.json');
    assert.ok(fs.existsSync(launchPath), 'vscode-extension/.vscode/launch.json');
    const launch = JSON.parse(fs.readFileSync(launchPath, 'utf8')) as {
      configurations?: Array<{ type?: string; args?: string[] }>;
    };
    const types = (launch.configurations ?? []).map((c) => c.type);
    assert.ok(types.includes('extensionHost'), 'missing type: extensionHost');
    const args = (launch.configurations ?? []).flatMap((c) => c.args ?? []);
    assert.ok(
      args.some((a) => a.includes('--extensionDevelopmentPath')),
      'missing --extensionDevelopmentPath',
    );
    assert.ok(
      args.some((a) => a.includes('--extensionTestsPath')),
      'missing --extensionTestsPath',
    );
  });
});

describe('grammar and themes', () => {
  it('ships a grammar file', () => {
    const grammar = pkg.contributes.grammars[0] as { path?: string };
    assert.ok(grammar?.path, 'missing grammar path');
    assert.ok(fs.existsSync(path.join(EXT_ROOT, grammar.path)), grammar.path);
  });

  it('matches comparison and shifts before a bare equals sign', () => {
    const grammar = pkg.contributes.grammars[0] as { path: string };
    const json = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, grammar.path), 'utf8')) as {
      fileTypes?: string[];
      repository: { operators: { patterns: Array<{ match?: string }> }; comments: { patterns: Array<{ match?: string }> } };
    };
    const matches = json.repository.operators.patterns.map((pattern) => pattern.match ?? '');
    const eq = matches.findIndex((match) => match.includes('(?!='));
    const cmp = matches.findIndex((match) => match.includes('=='));
    const shift = matches.findIndex((match) => match.includes('<<'));
    assert.ok(cmp >= 0 && eq > cmp, '== must be tokenized before =');
    assert.ok(shift >= 0 && shift < matches.findIndex((match) => match === '<|>'), '<< must be tokenized before <');
    assert.ok(json.fileTypes?.includes('psc'), 'grammar fileTypes include psc');
    const comments = JSON.stringify(json.repository.comments);
    assert.ok(!comments.includes('number-sign'), 'Pine has no # line comments');
  });

  it('ships four themes on disk, including a light variant', () => {
    const themes = pkg.contributes.themes as Array<{ path: string; label: string; uiTheme?: string }>;
    assert.equal(themes.length, 4, `expected 4 themes, got ${themes.length}`);
    const day = themes.find((theme) => theme.label === 'AXIS Day');
    assert.ok(day, 'AXIS Day light theme');
    assert.equal(day.uiTheme, 'vs');
    for (const theme of themes) {
      assert.ok(fs.existsSync(path.join(EXT_ROOT, theme.path)), theme.path);
    }
  });

  it('gives hover, suggest, peek, and inlay the AXIS card chrome', () => {
    const required = [
      'editorHoverWidget.background',
      'editorHoverWidget.border',
      'editorHoverWidget.statusBarBackground',
      'editorHoverWidget.highlightForeground',
      'editorHoverWidget.foreground',
      'textPreformat.foreground',
      'textPreformat.background',
      'textBlockQuote.border',
      'editorSuggestWidget.background',
      'editorSuggestWidget.border',
      'editorSuggestWidget.selectedBackground',
      'editorSuggestWidget.selectedForeground',
      'editorSuggestWidget.selectedIconForeground',
      'editorSuggestWidget.highlightForeground',
      'editorSuggestWidget.focusHighlightForeground',
      'editorSuggestWidgetStatus.foreground',
      'widget.shadow',
      'widget.border',
      'peekView.border',
      'peekViewTitle.background',
      'peekViewEditor.background',
      'peekViewResult.background',
      'editorInlayHint.foreground',
      'editorInlayHint.background',
      'editorInlayHint.parameterForeground',
      'editorGhostText.foreground',
      'editorActionList.background',
      'textCodeBlock.background',
      'textSeparator.foreground',
      'keybindingLabel.background',
      'menu.background',
      'quickInputList.focusBackground',
    ];
    const themes = pkg.contributes.themes as Array<{ path: string; label: string }>;
    for (const theme of themes) {
      const json = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, theme.path), 'utf8')) as {
        colors?: Record<string, string>;
      };
      const colors = json.colors ?? {};
      for (const key of required) {
        assert.ok(colors[key], `${theme.label} missing ${key}`);
      }
      assert.notEqual(
        colors['editorWarning.foreground']?.toUpperCase(),
        colors['editor.foreground']?.toUpperCase(),
        `${theme.label} warning color matches editor foreground`,
      );
      assert.notEqual(
        colors['editorWarning.foreground']?.toUpperCase(),
        '#EEEEEE',
        `${theme.label} warning color is plain white`,
      );
    }
  });

  it('colors Pine series/simple semantic tokens', () => {
    const themes = pkg.contributes.themes as Array<{ path: string; label: string }>;
    for (const theme of themes) {
      const json = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, theme.path), 'utf8')) as {
        semanticTokenColors?: Record<string, unknown>;
      };
      const sem = json.semanticTokenColors ?? {};
      assert.ok(sem.series, `${theme.label} missing semanticTokenColors.series`);
      assert.ok(sem.simple, `${theme.label} missing semanticTokenColors.simple`);
      assert.notEqual(sem.series, sem.simple, `${theme.label} series and simple share a color`);
    }
  });
});
