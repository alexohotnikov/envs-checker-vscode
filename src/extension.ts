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

  // Регистрация провайдера кодовых действий
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('*', new EnvCodeActionProvider(), {
      providedCodeActionKinds: EnvCodeActionProvider.providedCodeActionKinds
    })
  );
}

class EnvCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
    return context.diagnostics.map(diagnostic => this.createFix(document, diagnostic));
  }

  private createFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const fix = new vscode.CodeAction(`Исправить: ${diagnostic.message}`, vscode.CodeActionKind.QuickFix);
    fix.edit = new vscode.WorkspaceEdit();

    const exampleFilePath = path.join(path.dirname(document.fileName), '.env.development.example');
    const exampleContent = fs.readFileSync(exampleFilePath, 'utf-8');
    const exampleVariables = parseEnvContent(exampleContent);

    if (diagnostic.message.startsWith('Отсутствует переменная')) {
      const variableName = diagnostic.message.split(': ')[1];
      const variableValue = exampleVariables.get(variableName) || '';
      fix.edit.insert(document.uri, new vscode.Position(document.lineCount, 0), `\n${variableName}=${variableValue}\n`);
    } else if (diagnostic.message.startsWith('Лишняя переменная')) {
      const line = diagnostic.range.start.line;
      fix.edit.delete(document.uri, new vscode.Range(line, 0, line + 1, 0));
    }

    fix.diagnostics = [diagnostic];
    return fix;
  }
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

  // Найти недостающие переменные
  for (const key of exampleVariables.keys()) {
    if (!envVariables.has(key)) {
      const diagnostic = createDiagnostic(0, `Отсутствует переменная: ${key}`);
      diagnostics.push(diagnostic);
    }
  }

  // Найти лишние переменные
  for (const key of envVariables.keys()) {
    if (!exampleVariables.has(key)) {
      const line = findLineForKey(document, key);
      const diagnostic = createDiagnostic(line, `Лишняя переменная: ${key}`);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

function parseEnvContent(content: string): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) { // Игнорируем пустые строки и комментарии
      const [key, ...rest] = trimmedLine.split('=');
      const value = rest.join('='); // Восстанавливаем значение, если оно содержит '='
      map.set(key.trim(), value ? value.trim() : null);
    }
  }
  return map;
}

function findLineForKey(document: vscode.TextDocument, key: string): number {
  const lines = document.getText().split('\n');
  return lines.findIndex(line => line.trim().startsWith(key));
}

function createDiagnostic(line: number, message: string): vscode.Diagnostic {
  const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
  return new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
}

export function deactivate() {}