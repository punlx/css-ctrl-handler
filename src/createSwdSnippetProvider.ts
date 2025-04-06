// createSwdSnippetProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { indentUnit } from './generateGenericProvider';

export function createSwdSnippetProvider() {
  return vscode.languages.registerCompletionItemProvider(
    [
      { language: 'typescript', scheme: 'file' },
      { language: 'typescriptreact', scheme: 'file' },
    ],
    {
      provideCompletionItems(document, position) {
        // 1) ต้องเป็น .swd.ts
        if (!document.fileName.endsWith('.swd.ts')) {
          return;
        }

        // 2) ดูคำก่อน cursor
        const lineText = document.lineAt(position).text;
        const textBeforeCursor = lineText.substring(0, position.character);

        // 3) เช็กว่า token ล่าสุดเป็น "swdc" ใช่ไหม
        if (!/\bswdc$/.test(textBeforeCursor)) {
          return;
        }

        // ดึงชื่อไฟล์มาตัด ".swd.ts" ออก
        const fileName = path.basename(document.fileName, '.swd.ts');

        // 4) สร้าง snippet
        const snippetItem = new vscode.CompletionItem(
          'create styledwind template',
          vscode.CompletionItemKind.Snippet
        );
        snippetItem.filterText = 'swdc'; // ให้ VSCode จับ match กับ "swdc"

        const snippet = new vscode.SnippetString(
          `import { styled } from 'styledwindjs'

export const ${fileName}css = styled<{  }>\`
${indentUnit}@scope ${fileName}

${indentUnit}\${1}
\`;
`
        );

        snippetItem.insertText = snippet;
        snippetItem.detail = 'Create a Styledwind template (swd)';
        snippetItem.documentation = new vscode.MarkdownString(
          'Insert a basic styledwind template snippet.'
        );

        return [snippetItem];
      },
    },
    'c'
  );
}
