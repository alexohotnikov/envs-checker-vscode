import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('envCheck');

  let disposable = vscode.commands.registerCommand('extension.checkEnvFiles', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Активный редактор не найден.');
      return;
    }

    const document = editor.document;
    if (!document.fileName.endsWith('.env.development')) {
      vscode.window.showErrorMessage('Эту команду можно выполнять только для файлов .env.development.');
      return;
    }

    checkEnvFiles(document, diagnosticCollection);
  });

  let fixAllDisposable = vscode.commands.registerCommand('extension.fixAllEnvIssues', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Активный редактор не найден.');
      return;
    }

    const document = editor.document;
    if (!document.fileName.endsWith('.env.development')) {
      vscode.window.showErrorMessage('Эту команду можно выполнять только для файлов .env.development.');
      return;
    }

    fixAllEnvIssues(document, diagnosticCollection);
  });

  vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.fileName.endsWith('.env.development')) {
      checkEnvFiles(document, diagnosticCollection);
    }
  });

  vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.fileName.endsWith('.env.development')) {
      checkEnvFiles(document, diagnosticCollection);
    }
  });

  context.subscriptions.push(diagnosticCollection);
  context.subscriptions.push(disposable);
  context.subscriptions.push(fixAllDisposable);
}

function checkEnvFiles(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection) {
  const exampleFilePath = path.join(path.dirname(document.fileName), '.env.development.example');

  if (!fs.existsSync(exampleFilePath)) {
    vscode.window.showErrorMessage('Файл .env.development.example не найден.');
    return;
  }

  const envContent = document.getText();
  const exampleContent = fs.readFileSync(exampleFilePath, 'utf-8');

  const envVariables = parseEnvContent(envContent);
  const exampleVariables = parseEnvContent(exampleContent);

  const diagnostics: vscode.Diagnostic[] = [];

  for (const key of exampleVariables.keys()) {
    if (!envVariables.has(key)) {
      diagnostics.push(createDiagnostic(0, `Отсутствует переменная: ${key}`));
    }
  }

  for (const key of envVariables.keys()) {
    if (!exampleVariables.has(key)) {
      const line = findLineForKey(document, key);
      if (line !== -1) {
        diagnostics.push(createDiagnostic(line, `Лишняя переменная: ${key}`));
      }
    }
  }

  diagnosticCollection.set(document.uri, diagnostics);

  if (diagnostics.length === 0) {
    vscode.window.showInformationMessage('Файл .env.development не содержит ошибок! ✅');
  }
}

function fixAllEnvIssues(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection) {
  const exampleFilePath = path.join(path.dirname(document.fileName), '.env.development.example');

  if (!fs.existsSync(exampleFilePath)) {
    vscode.window.showErrorMessage('Файл .env.development.example не найден.');
    return;
  }

  const envContent = document.getText();
  const exampleContent = fs.readFileSync(exampleFilePath, 'utf-8');

  const envVariables = parseEnvContent(envContent);
  const exampleVariables = parseEnvContent(exampleContent);

  const missingVariables: string[] = [];
  const extraVariables: string[] = [];

  for (const key of exampleVariables.keys()) {
    if (!envVariables.has(key)) {
      missingVariables.push(`${key}=${exampleVariables.get(key) || ''}`);
    }
  }

  for (const key of envVariables.keys()) {
    if (!exampleVariables.has(key)) {
      extraVariables.push(key);
    }
  }

  let newEnvContent = envContent;
  if (missingVariables.length > 0) {
    newEnvContent += '\n' + missingVariables.join('\n') + '\n';
  }

  if (extraVariables.length > 0) {
    newEnvContent = newEnvContent
      .split('\n')
      .filter(line => !extraVariables.some(key => line.startsWith(key + '=')))
      .join('\n');
  }

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.lineAt(0).range.start,
    document.lineAt(document.lineCount - 1).range.end
  );
  edit.replace(document.uri, fullRange, newEnvContent);
  vscode.workspace.applyEdit(edit);

  // После исправления пересчитываем диагностические ошибки
  checkEnvFiles(document, diagnosticCollection);
}

function createDiagnostic(line: number, message: string): vscode.Diagnostic {
  const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
  return new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
}

function findLineForKey(document: vscode.TextDocument, key: string): number {
  const lines = document.getText().split('\n');
  return lines.findIndex(line => line.trim().startsWith(key));
}

function parseEnvContent(content: string): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...rest] = trimmedLine.split('=');
      const value = rest.join('=');
      map.set(key.trim(), value ? value.trim() : null);
    }
  }
  return map;
}

export function deactivate() {}