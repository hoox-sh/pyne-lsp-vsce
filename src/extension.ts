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
 * PYNE — VS Code extension (HOOX open trading stack).
 * Language Client for pyne-lsp (alias: pynescript-lsp).
 *
 * Unofficial independent project. Not affiliated with or endorsed by TradingView, Inc.
 * Pine Script™ and TradingView® are trademarks of TradingView, Inc.
 */

import {
  commands,
  ConfigurationTarget,
  Diagnostic,
  DiagnosticSeverity,
  env,
  ExtensionContext,
  languages,
  Position,
  ProgressLocation,
  Range,
  StatusBarAlignment,
  TextDocument,
  TextEdit,
  Uri,
  version as vscodeVersion,
  window,
  workspace,
} from 'vscode';
import { ExecuteCommandRequest } from 'vscode-languageclient/node';
import { isAxisIdePresent, runOnPro, startBackend, testBackend } from './backend';
import { COMMANDS } from './commands';
import {
  cfg,
  effectiveSettingsSnapshot,
  PINESCRIPT,
  serverSettings,
  togglePinescriptEditor,
  togglePyneBool,
} from './config';
import { convertSuccessMessage, convertViaPython, type ConvertToV6Payload } from './convert';
import { LOOKAHEAD_STATIC_NOTE, scanPineLookahead } from './lookahead';
import { installBackend, installLanguageServer, setLanguageServerRestarter } from './install';
import { isPineDocument, PINE_LANGUAGE_ID, shouldNormalizeToPinescript } from './language';
import { findUrlOnLine } from './links';
import { log, logDebug, logSection, setStatus } from './log';
import {
  applyServerTrace,
  getClient,
  isClientRunning,
  resolveLspLaunch,
  startClient,
  stopClient,
  withClientLock,
} from './lsp';
import { registerMcpServer } from './mcp';
import { copyTroubleshootingReport } from './report';
import {
  LEGACY_PRO_KEY_SETTING,
  clearProKey,
  migrateLegacyProKey,
  setProKey,
} from './secrets';
import { state } from './state';
import { applyPyneSyntax, themeChoices } from './syntax';

export { COMMANDS } from './commands';
export { resolveLspLaunch } from './lsp';
export { PINE_LANGUAGE_ID } from './language';

async function normalizePineLanguage(doc: TextDocument): Promise<void> {
  if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') {
    return;
  }
  if (!shouldNormalizeToPinescript(doc.languageId, doc.fileName || doc.uri.fsPath)) {
    return;
  }
  try {
    log(`Normalizing languageId ${doc.languageId} → ${PINE_LANGUAGE_ID} (${doc.uri.toString()})`);
    await languages.setTextDocumentLanguage(doc, PINE_LANGUAGE_ID);
  } catch (err) {
    log(
      `Could not set languageId to ${PINE_LANGUAGE_ID}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function registerCommands(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand(COMMANDS.showLspOutput, () => {
      if (!state.output) {
        void window.showWarningMessage('PYNE output channel is not available.');
        return;
      }
      state.output.show(true);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.showStatus, async () => {
      const running = isClientRunning();
      const launch = state.resolvedLaunch;
      const items: Array<{ id: string; label: string; description?: string }> = [
        { id: 'output', label: '$(output) Show Language Server Output' },
        {
          id: 'report',
          label: '$(clippy) Copy Troubleshooting Report',
          description: 'launch, Python, versions, settings (redacted)',
        },
        { id: 'restart', label: '$(debug-restart) Restart Language Server' },
        { id: 'launch', label: '$(terminal) Show Resolved Launch Command' },
      ];
      if (!running) {
        items.unshift({
          id: 'install',
          label: '$(cloud-download) Install Language Server',
          description: 'pip install "hoox-pyne[lsp]"',
        });
      }
      const pick = await window.showQuickPick(items, {
        title: 'PYNE',
        placeHolder: running
          ? `Language server running${launch ? `: ${launch.label}` : ''}`
          : 'PYNE language server is not running',
        matchOnDescription: true,
      });
      if (!pick) {
        return;
      }
      if (pick.id === 'install') {
        await installLanguageServer({ restart: true });
      } else if (pick.id === 'output') {
        state.output?.show(true);
      } else if (pick.id === 'report') {
        await copyTroubleshootingReport();
      } else if (pick.id === 'restart') {
        await commands.executeCommand(COMMANDS.restartServer);
      } else if (pick.id === 'launch') {
        await commands.executeCommand(COMMANDS.showLspCommand);
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.installLanguageServer, async () => {
      await installLanguageServer({ restart: true });
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.installBackend, async () => {
      await installBackend();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.startBackend, async () => {
      await startBackend();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.testBackend, async () => {
      await testBackend();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.selectSyntax, async () => {
      const pick = await window.showQuickPick(themeChoices(), {
        placeHolder: 'Select a Pine syntax highlighting palette (None = active theme)',
        matchOnDescription: true,
      });
      if (!pick) {
        return;
      }
      await workspace
        .getConfiguration('pynescript')
        .update('syntaxHighlighting', pick.id, ConfigurationTarget.Global);
      await applyPyneSyntax();
      void window.showInformationMessage(`PYNE syntax highlighting: ${pick.label}.`);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.restartServer, async () => {
      try {
        await withClientLock(async () => {
          log('Restart requested.');
          await startClient();
        });
        if (isClientRunning()) {
          void window.showInformationMessage('PYNE language server restarted.');
        } else if (cfg<boolean>('lsp.enabled') !== false) {
          void window.showWarningMessage(
            'PYNE language server did not start. See “PYNE: Show Language Server Output”.',
          );
        }
      } catch {
        /* error already shown / logged */
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.formatDocument, async () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        void window.showWarningMessage('No active editor to format.');
        return;
      }
      if (!isPineDocument(editor.document)) {
        void window.showWarningMessage('Format Document is only available for .pyne / .pine files.');
        return;
      }
      if (cfg<boolean>('formatting.enabled') === false) {
        void window.showWarningMessage('Formatting is disabled (pynescript.formatting.enabled).');
        return;
      }
      if (!isClientRunning()) {
        void window.showWarningMessage(
          'PYNE language server is not running — cannot format. Try “PYNE: Restart Language Server”.',
        );
        return;
      }
      try {
        await commands.executeCommand('editor.action.formatDocument');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`formatDocument failed: ${msg}`);
        void window.showErrorMessage(`Format failed: ${msg}`);
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.showLspCommand, async () => {
      const launch = resolveLspLaunch();
      const line = `${launch.command} ${launch.args.join(' ')}`.trim();
      const running = isClientRunning();
      logDebug(
        `Resolved launch: ${line} (found=${launch.found}, running=${running})`,
      );
      const pick = await window.showInformationMessage(
        `LSP launch (${running ? 'running' : 'not running'}): ${line}`,
        'Copy Command',
        'Copy Report',
        'Show Output',
      );
      if (pick === 'Copy Command') {
        await env.clipboard.writeText(line);
        void window.showInformationMessage('Copied LSP launch command.');
      } else if (pick === 'Copy Report') {
        await copyTroubleshootingReport();
      } else if (pick === 'Show Output') {
        state.output?.show(true);
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.copyTroubleshootingReport, async () => {
      await copyTroubleshootingReport();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.convertToV6, async () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        void window.showWarningMessage('No active editor to convert.');
        return;
      }
      if (!isPineDocument(editor.document)) {
        void window.showWarningMessage('Convert to Pine v6 is only available for .pyne / .pine files.');
        return;
      }
      const prev = editor.document.getText();
      let next = prev;
      let fromVersion: number | undefined;
      const client = getClient();
      const convert = async (): Promise<void> => {
        if (isClientRunning() && client) {
          const payload = (await client.sendRequest(ExecuteCommandRequest.type, {
            command: COMMANDS.convertToV6,
            arguments: [editor.document.uri.toString()],
          })) as ConvertToV6Payload | null;
          if (payload && typeof payload.source === 'string') {
            next = payload.source;
            fromVersion = payload.from_version;
            return;
          }
        }
        next = await convertViaPython(prev);
      };
      try {
        await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: 'PYNE: Converting to Pine v6…',
          },
          () => convert(),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`convertToV6 failed: ${msg}`);
        try {
          next = await convertViaPython(prev);
        } catch (err2) {
          const msg2 = err2 instanceof Error ? err2.message : String(err2);
          void window.showErrorMessage(`Convert to Pine v6 failed: ${msg2}`);
          return;
        }
      }
      if (next === prev) {
        void window.showInformationMessage('Already Pine v6.');
        return;
      }
      const full = new Range(
        editor.document.positionAt(0),
        editor.document.positionAt(prev.length),
      );
      const ok = await editor.edit((builder) => builder.replace(full, next));
      if (!ok) {
        void window.showErrorMessage('Convert to Pine v6 could not apply the edit.');
        return;
      }
      void window.showInformationMessage(convertSuccessMessage(fromVersion));
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.diagnosticsToggle, async () => {
      const next = await togglePyneBool('diagnostics.enabled', 'diagnostics');
      if (!next) {
        getClient()?.diagnostics?.clear();
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.completionToggle, async () => {
      await togglePyneBool('completion.snippets', 'snippet completions');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.inlayHintsToggle, async () => {
      // The server only emits parameter names when inlayHints.parameters is
      // true. The configuration listener turns the editor decoration on with it.
      await togglePyneBool('inlayHints.parameters', 'parameter inlay hints');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.foldingToggle, async () => {
      await togglePinescriptEditor('folding', true, false, 'folding');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.colorPreviewToggle, async () => {
      await togglePinescriptEditor('colorDecorators', true, false, 'color preview');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleHover, async () => {
      await togglePyneBool('hover.enabled', 'hover');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleSignatureHelp, async () => {
      await togglePyneBool('signatureHelp.enabled', 'signature help');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleSemanticTokens, async () => {
      // Gate is enforced client-side via pynescript.semanticTokens.enabled.
      // Also flip the editor setting so VS Code stops requesting tokens.
      const next = await togglePyneBool('semanticTokens.enabled', 'semantic tokens');
      await workspace
        .getConfiguration('editor', PINESCRIPT)
        .update('semanticHighlighting.enabled', next, ConfigurationTarget.Global, true);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleDocumentHighlight, async () => {
      await togglePyneBool('documentHighlight.enabled', 'document highlight');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleLinkedEditing, async () => {
      // Also flip [pinescript] editor.linkedEditing so rename-as-you-type
      // actually runs; the LSP gate alone is not enough.
      const next = await togglePyneBool('linkedEditing.enabled', 'linked editing');
      await workspace
        .getConfiguration('editor', PINESCRIPT)
        .update('linkedEditing', next, ConfigurationTarget.Global, true);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleSelectionRange, async () => {
      await togglePyneBool('selectionRange.enabled', 'selection range');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleDocumentLink, async () => {
      await togglePyneBool('documentLink.enabled', 'document links');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleCodeAction, async () => {
      await togglePyneBool('codeAction.enabled', 'code actions');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.toggleFormatOnSave, async () => {
      await togglePyneBool('formatOnSave.enabled', 'format on save');
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.openDocumentLink, async () => {
      const editor = window.activeTextEditor;
      if (!editor || !isPineDocument(editor.document)) {
        return;
      }
      const line = editor.document.lineAt(editor.selection.active.line);
      const url = findUrlOnLine(line.text, editor.selection.active.character);
      if (!url) {
        void window.showInformationMessage('No link under the cursor.');
        return;
      }
      try {
        await env.openExternal(Uri.parse(url));
      } catch {
        void window.showWarningMessage(`Could not open link: ${url}`);
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.runOnPro, async () => {
      await runOnPro();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.setProKey, async () => {
      if (!state.secrets) {
        void window.showErrorMessage('PYNE SecretStorage is not ready.');
        return;
      }
      const raw = await window.showInputBox({
        password: true,
        ignoreFocusOut: true,
        prompt:
          'Paste a PYNE Pro API key. Empty input clears the stored key. Keys live in SecretStorage, never settings.json.',
      });
      if (raw === undefined) return;
      const result = await setProKey(state.secrets, raw);
      if (!result.ok) {
        void window.showErrorMessage(result.error);
        return;
      }
      void window.showInformationMessage(
        raw.trim()
          ? 'PYNE Pro key saved (SecretStorage).'
          : 'PYNE Pro key cleared (SecretStorage).',
      );
    }),
  );

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.clearProKey, async () => {
      if (!state.secrets) {
        void window.showErrorMessage('PYNE SecretStorage is not ready.');
        return;
      }
      const result = await clearProKey(state.secrets);
      if (!result.ok) {
        void window.showErrorMessage(result.error);
        return;
      }
      void window.showInformationMessage('PYNE Pro key cleared (SecretStorage).');
    }),
  );
}

export async function activate(context: ExtensionContext): Promise<void> {
  state.globalStorageDir = context.globalStorageUri.fsPath;
  state.extensionPath = context.extensionPath;
  state.secrets = context.secrets;
  try {
    const inspect = workspace.getConfiguration('pynescript').inspect<string>(LEGACY_PRO_KEY_SETTING);
    const leftover =
      inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue;
    await migrateLegacyProKey(context.secrets, leftover, async () => {
      const cfgObj = workspace.getConfiguration('pynescript');
      await cfgObj.update(LEGACY_PRO_KEY_SETTING, undefined, ConfigurationTarget.Global);
      await cfgObj.update(LEGACY_PRO_KEY_SETTING, undefined, ConfigurationTarget.Workspace);
    });
  } catch {
    /* leftover setting may already be gone */
  }
  setLanguageServerRestarter(() => withClientLock(() => startClient()));
  state.extensionVersion = String(context.extension.packageJSON.version ?? '');
  state.output = window.createOutputChannel('PYNE Language Server', { log: true });
  context.subscriptions.push(state.output);
  logSection('activation');
  log(
    `Activating PYNE ${state.extensionVersion || 'extension'} (VS Code ${vscodeVersion})…`,
  );

  state.statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  state.statusBar.name = 'PYNE LSP';
  state.statusBar.command = COMMANDS.showLspOutput;
  context.subscriptions.push(state.statusBar);
  setStatus('$(sync~spin) PYNE…', 'Activating');

  // Register commands first so palette never shows "command not found"
  // even if the language server fails to start.
  registerCommands(context);

  // MCP is independent of the language server: register it early so agent
  // mode can discover PYNE tools even when no .pine file is open. A missing
  // MCP API must not break activation (and the language server below).
  try {
    registerMcpServer(context);
  } catch (err) {
    log(`MCP registration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const lookaheadDiags = languages.createDiagnosticCollection('pynescript.lookahead');
  context.subscriptions.push(lookaheadDiags);
  const refreshLookahead = (doc: TextDocument): void => {
    if (!isPineDocument(doc)) {
      lookaheadDiags.delete(doc.uri);
      return;
    }
    const report = scanPineLookahead(doc.getText());
    const items: Diagnostic[] = [];
    for (const hit of report.hits) {
      const lineNo = Math.max(0, Math.min(hit.line, Math.max(doc.lineCount - 1, 0)));
      let lineLen = 0;
      try {
        lineLen = doc.lineAt(lineNo).text.length;
      } catch {
        lineLen = 0;
      }
      const startCol = Math.max(0, Math.min(hit.col, lineLen));
      const endCol = Math.max(startCol + 1, Math.min(startCol + Math.max(hit.text.length, 1), lineLen));
      const diag = new Diagnostic(
        new Range(new Position(lineNo, startCol), new Position(lineNo, endCol)),
        `Static grep: ${hit.kind} may repaint on historical bars. ${LOOKAHEAD_STATIC_NOTE}`,
        DiagnosticSeverity.Warning,
      );
      diag.source = 'PYNE';
      diag.code = 'pyne.lookahead.static';
      items.push(diag);
    }
    lookaheadDiags.set(doc.uri, items);
  };
  for (const doc of workspace.textDocuments) {
    refreshLookahead(doc);
  }
  context.subscriptions.push(
    workspace.onDidOpenTextDocument((doc) => refreshLookahead(doc)),
    workspace.onDidChangeTextDocument((e) => refreshLookahead(e.document)),
    workspace.onDidCloseTextDocument((doc) => lookaheadDiags.delete(doc.uri)),
  );

  void commands.executeCommand('setContext', 'pynescript.axisPresent', isAxisIdePresent());

  const normalizeOpenDocs = async (): Promise<void> => {
    for (const doc of workspace.textDocuments) {
      await normalizePineLanguage(doc);
    }
  };

  // The extension now activates at startup for MCP discovery. Do not spawn a
  // Python language server in workspaces that have no Pine document; start it
  // lazily on the first Pine file instead.
  let startingClient = false;
  const ensureClientStarted = async (): Promise<void> => {
    if (startingClient || isClientRunning()) {
      return;
    }
    startingClient = true;
    try {
      await withClientLock(() => startClient());
    } catch {
      /* already reported */
    } finally {
      startingClient = false;
    }
  };

  context.subscriptions.push(
    workspace.onDidOpenTextDocument((doc) => {
      void (async () => {
        await normalizePineLanguage(doc);
        if (isPineDocument(doc)) {
          await ensureClientStarted();
        }
      })();
    }),
  );
  await normalizeOpenDocs();

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration('pynescript.syntaxHighlighting') ||
        e.affectsConfiguration('workbench.colorTheme')
      ) {
        await applyPyneSyntax();
      }
      if (e.affectsConfiguration('pynescript.inlayHints.parameters')) {
        await syncInlayEditor();
      }
      if (e.affectsConfiguration('pynescript.logging.level')) {
        log(`Log level set to ${cfg<string>('logging.level') || 'info'}.`);
      }
      if (e.affectsConfiguration('pynescript.trace.server')) {
        await applyServerTrace();
      }
      if (
        e.affectsConfiguration('pynescript.lsp') ||
        e.affectsConfiguration('pynescript.install.python')
      ) {
        log('LSP launch configuration changed — restarting client.');
        try {
          await withClientLock(() => startClient());
        } catch {
          /* shown */
        }
      } else if (
        e.affectsConfiguration('pynescript.formatting') ||
        e.affectsConfiguration('pynescript.diagnostics') ||
        e.affectsConfiguration('pynescript.completion') ||
        e.affectsConfiguration('pynescript.inlayHints') ||
        e.affectsConfiguration('pynescript.codeLens') ||
        e.affectsConfiguration('pynescript.inlineCompletion') ||
        e.affectsConfiguration('pynescript.pro')
      ) {
        log('Feature configuration changed — sending workspace/didChangeConfiguration.');
        getClient()?.sendNotification('workspace/didChangeConfiguration', {
          settings: serverSettings(),
        });
      }
    }),
  );

  const hasPineWorkspaceFile = async (): Promise<boolean> => {
    if (!workspace.workspaceFolders?.length) {
      return false;
    }
    try {
      const found = await workspace.findFiles(
        '**/*.{pyne,pine,pinev5,pinev6,pinescript,psc}',
        '**/node_modules/**',
        1,
      );
      return found.length > 0;
    } catch {
      return false;
    }
  };

  await syncInlayEditor();
  await applyPyneSyntax();

  if (
    workspace.textDocuments.some(isPineDocument) ||
    cfg<boolean>('lsp.enabled') === false ||
    (await hasPineWorkspaceFile())
  ) {
    await ensureClientStarted();
  } else {
    log('No Pine document or workspace file — language server starts on the first Pine file.');
    setStatus('$(check) PYNE LSP', 'Idle — starts with a Pine file');
  }

  // Format on save: resolve the LSP edits before the file is written. Using
  // the provider directly (rather than `editor.action.formatDocument` after
  // save) means the saved bytes are already formatted.
  context.subscriptions.push(
    workspace.onWillSaveTextDocument((event) => {
      const { document } = event;
      if (!isPineDocument(document)) {
        return;
      }
      if (cfg<boolean>('formatOnSave.enabled') === false) {
        return;
      }
      if (cfg<boolean>('formatting.enabled') === false) {
        return;
      }
      if (!isClientRunning()) {
        return;
      }
      event.waitUntil(
        (async () => {
          try {
            const editorConfig = workspace.getConfiguration('editor', document);
            const edits = await commands.executeCommand<TextEdit[]>(
              'vscode.executeFormatDocumentProvider',
              document.uri,
              {
                tabSize: editorConfig.get<number>('tabSize') ?? 4,
                insertSpaces: editorConfig.get<boolean>('insertSpaces') !== false,
              },
            );
            return edits ?? [];
          } catch (err) {
            log(`formatOnSave failed: ${err instanceof Error ? err.message : String(err)}`);
            return [];
          }
        })(),
      );
    }),
  );

  // Keep startup quiet: the full snapshot is debug-level and the launch line is
  // already logged by startClient, so activation does not re-probe Python.
  logDebug(`Effective settings: ${JSON.stringify(effectiveSettingsSnapshot())}`);
  if (state.resolvedLaunch) {
    logDebug(`Resolved LSP: ${state.resolvedLaunch.label} (found=${state.resolvedLaunch.found})`);
  }
  log('Activation complete.');
}

/** Keep the editor decoration in step with the server's parameter-hint gate. */
async function syncInlayEditor(): Promise<void> {
  const on = cfg<boolean>('inlayHints.parameters') === true;
  const desired = on ? 'on' : 'off';
  const editor = workspace.getConfiguration('editor', PINESCRIPT);
  if (editor.get('inlayHints.enabled') === desired) {
    return;
  }
  await editor.update('inlayHints.enabled', desired, ConfigurationTarget.Global, true);
}

export function deactivate(): Promise<void> | undefined {
  state.statusBar?.dispose();
  return withClientLock(() => stopClient());
}
