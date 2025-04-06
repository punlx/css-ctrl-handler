import { createEmptyStyleDef } from '../helpers/createEmptyStyleDef';
import { parseClassBlocksWithBraceCounting } from '../helpers/parseClassBlocksWithBraceCounting';
import { IClassBlock, IConstBlock, IParsedDirective } from '../types';
import { parseSingleAbbr } from './parseSingleAbbr';

export function parseDirectives(text: string): {
  directives: IParsedDirective[];
  classBlocks: IClassBlock[];
  constBlocks: IConstBlock[];
} {
  const directives: IParsedDirective[] = [];
  const classBlocks: IClassBlock[] = [];
  const constBlocks: IConstBlock[] = [];

  let newText = text;

  // --------------------------------------------------------
  // (1) parse @const <name> { ... }
  // --------------------------------------------------------
  const constRegex = /^[ \t]*@const\s+([\w-]+)\s*\{([\s\S]*?)\}/gm;
  const allConstMatches = [...newText.matchAll(constRegex)];
  for (const m of allConstMatches) {
    const fullMatch = m[0];
    const constName = m[1];
    const rawBlock = m[2];
    const partialDef = createEmptyStyleDef();
    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const ln of lines) {
      parseSingleAbbr(ln, partialDef, true, false);
    }
    constBlocks.push({ name: constName, styleDef: partialDef });
    newText = newText.replace(fullMatch, '').trim();
  }

  // --------------------------------------------------------
  // (2) parse directive top-level (@scope, @bind, etc.)
  // --------------------------------------------------------
  const directiveRegex = /^[ \t]*@([\w-]+)\s+([^\r\n]+)/gm;
  let dMatch: RegExpExecArray | null;
  directiveRegex.lastIndex = 0;
  while ((dMatch = directiveRegex.exec(newText)) !== null) {
    const dirName = dMatch[1];
    const dirValue = dMatch[2].trim();

    // (NEW) ถ้าเป็น @scope => check ชื่อ scope
    if (dirName === 'scope') {
      // สมมติเราต้องการอนุญาตแค่ [a-zA-Z0-9_-]+
      const scopeNameRegex = /^[a-zA-Z0-9_-]+$/;
      if (!scopeNameRegex.test(dirValue)) {
        throw new Error(
          `[SWD-ERR] scope name must contain only letters, digits, underscore, or dash. Got: "${dirValue}"`
        );
      }
    }

    // เก็บ directive ลง array
    directives.push({ name: dirName, value: dirValue });

    // ลบจาก newText
    newText = newText.replace(dMatch[0], '').trim();
    directiveRegex.lastIndex = 0;
  }

  // --------------------------------------------------------
  // (3) parse .className { ... }
  // --------------------------------------------------------
  const blocks = parseClassBlocksWithBraceCounting(newText);
  for (const blk of blocks) {
    classBlocks.push(blk);
  }

  return { directives, classBlocks, constBlocks };
}
