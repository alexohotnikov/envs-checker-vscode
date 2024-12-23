import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('envCheck');

  vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.fileName.endsWith('.env.development')) {
      checkEnvFiles(document, diagnosticCollection);
    }
  });

  context.subscriptions.push(diagnosticCollection);
}

function checkEnvFiles(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection) {
  const exampleFilePath = path.join(path.dirname(document.fileName), '.env.development.example');
  
  if (!fs.existsSync(exampleFilePath)) {
    vscode.window.showErrorMessage('env.development.example file not found');
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
      const line = findLineForKey(document, key);
      diagnostics.push(createDiagnostic(line, `Missing variable: ${key}`));
    }
  }

  // Найти лишние переменные
  for (const key of envVariables.keys()) {
    if (!exampleVariables.has(key)) {
      const line = findLineForKey(document, key);
      diagnostics.push(createDiagnostic(line, `Extra variable: ${key}`));
    }
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

function parseEnvContent(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = content.split('\n');
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key) {
      map.set(key.trim(), value ? value.trim() : '');
    }
  }
  return map;
}

function findLineForKey(document: vscode.TextDocument, key: string): number {
  const lines = document.getText().split('\n');
  return lines.findIndex(line => line.startsWith(key));
}

function createDiagnostic(line: number, message: string): vscode.Diagnostic {
  const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
  return new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
}

export function deactivate() {}