"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('envCheck');
    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.fileName.endsWith('.env.development')) {
            checkEnvFiles(document, diagnosticCollection);
        }
    });
    context.subscriptions.push(diagnosticCollection);
}
function checkEnvFiles(document, diagnosticCollection) {
    const exampleFilePath = path.join(path.dirname(document.fileName), '.env.development.example');
    if (!fs.existsSync(exampleFilePath)) {
        vscode.window.showErrorMessage('env.development.example file not found');
        return;
    }
    const envContent = document.getText();
    const exampleContent = fs.readFileSync(exampleFilePath, 'utf-8');
    const envVariables = parseEnvContent(envContent);
    const exampleVariables = parseEnvContent(exampleContent);
    const diagnostics = [];
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
function parseEnvContent(content) {
    const map = new Map();
    const lines = content.split('\n');
    for (const line of lines) {
        const [key, value] = line.split('=');
        if (key) {
            map.set(key.trim(), value ? value.trim() : '');
        }
    }
    return map;
}
function findLineForKey(document, key) {
    const lines = document.getText().split('\n');
    return lines.findIndex(line => line.startsWith(key));
}
function createDiagnostic(line, message) {
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    return new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map