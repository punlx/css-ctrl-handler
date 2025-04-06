import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IStyleDefinition } from './types';

import { ensureScopeUnique } from './utils/ensureScopeUnique';
import { parseDirectives } from './parsers/parseDirectives';
import { processClassBlocks } from './helpers/processClassBlocks';
import { handleBindDirectives } from './utils/handleBindDirectives';
import { transFormVariables } from './transformers/transformVariables';
import { transformLocalVariables } from './transformers/transformLocalVariables';
import { buildCssText } from './builders/buildCssText';

/* -------------------------------------------------------------------------
   (NEW) Global define / breakpoint / typography
------------------------------------------------------------------------- */
export const globalDefineMap: Record<string, Record<string, IStyleDefinition>> = {};


/* -------------------------------------------------------------------------
   globalDefineMap – ถ้าต้องการฟีเจอร์ @const / theme.define ข้ามไฟล์
------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------
   ฟังก์ชัน generateSwdCssFromSource - parse + generate CSS (ไม่มี Diagnostic)
------------------------------------------------------------------------- */
export function generateSwdCssFromSource(sourceText: string): string {
  const { directives, classBlocks, constBlocks } = parseDirectives(sourceText);

  const scopeDir = directives.find((d) => d.name === 'scope');
  if (!scopeDir) {
    throw new Error(`[SWD-ERR] You must provide "@scope <name>" in styled(...) block.`);
  }
  const scopeName = scopeDir.value;

  ensureScopeUnique(scopeName);

  const constMap = new Map<string, IStyleDefinition>();
  for (const c of constBlocks) {
    constMap.set(c.name, c.styleDef);
  }

  const classNameDefs = processClassBlocks(scopeName, classBlocks, constMap);

  handleBindDirectives(scopeName, directives, classNameDefs);

  let finalCss = '';
  for (const [displayKey, styleDef] of classNameDefs.entries()) {
    const className = displayKey.replace(`${scopeName}_`, '');
    transFormVariables(styleDef, scopeName, className);
    transformLocalVariables(styleDef, scopeName, className);
    finalCss += buildCssText(displayKey, styleDef);
  }

  return finalCss;
}

/* -------------------------------------------------------------------------
   ฟังก์ชัน createSwdCssFile(doc)
   – ทำหน้าที่: 
     1) แก้ import line ในไฟล์ .swd.ts
     2) generate CSS (ถ้า parse error => throw)
     3) เขียนไฟล์ .swd.css
   – **ไม่มี** การ set Diagnostic ในนี้
------------------------------------------------------------------------- */
export async function createSwdCssFile(doc: vscode.TextDocument) {
  if (!doc.fileName.endsWith('.swd.ts')) {
    return;
  }

  const fileName = path.basename(doc.fileName);
  const base = fileName.replace(/\.swd\.ts$/, '');

  const currentDir = path.dirname(doc.fileName);
  const newCssFilePath = path.join(currentDir, base + '.swd.css');
  if (!fs.existsSync(newCssFilePath)) {
    fs.writeFileSync(newCssFilePath, '', 'utf8');
  }

  const relImport = `./${base}.swd.css`;
  const importLine = `import '${relImport}';\n`;

  const fullText = doc.getText();
  const sanitizedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const oldRegex = new RegExp(
    `^import\\s+["'][^"']*${sanitizedBase}\\.swd\\.css["'];?\\s*(?:\\r?\\n)?`,
    'm'
  );
  let newText = fullText.replace(oldRegex, '');
  newText = newText.replace(/\n{2,}/g, '\n');
  const finalText = importLine + newText;

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    doc.lineAt(doc.lineCount - 1).range.end
  );
  edit.replace(doc.uri, fullRange, finalText);
  await vscode.workspace.applyEdit(edit);

  const sourceText = finalText.replace(importLine, '');
  let generatedCss: string;
  try {
    generatedCss = generateSwdCssFromSource(sourceText);
  } catch (err) {
    vscode.window.showErrorMessage(`Styledwind parse error: ${(err as Error).message}`);
    throw err;
  }

  fs.writeFileSync(newCssFilePath, generatedCss, 'utf8');
}
