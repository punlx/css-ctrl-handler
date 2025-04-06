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

  const directiveRegex = /^[ \t]*@([\w-]+)\s+([^\r\n]+)/gm;
  let dMatch: RegExpExecArray | null;
  directiveRegex.lastIndex = 0;
  while ((dMatch = directiveRegex.exec(newText)) !== null) {
    const dirName = dMatch[1];
    const dirValue = dMatch[2].trim();
    if (dirName === 'use' || dirName === 'query') {
      continue;
    }
    directives.push({ name: dirName, value: dirValue });
    newText = newText.replace(dMatch[0], '').trim();
    directiveRegex.lastIndex = 0;
  }

  const blocks = parseClassBlocksWithBraceCounting(newText);
  for (const blk of blocks) {
    classBlocks.push(blk);
  }

  return { directives, classBlocks, constBlocks };
}
