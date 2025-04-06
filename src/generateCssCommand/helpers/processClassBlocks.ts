// src/generateCssCommand/helpers/processClassBlocks.ts

import { parseSingleAbbr } from '../parsers/parseSingleAbbr';
import { IClassBlock, IStyleDefinition } from '../types';
import { extractQueryBlocks } from '../utils/extractQueryBlocks';
import { mergeStyleDef } from '../utils/mergeStyleDef';
import { createEmptyStyleDef } from './createEmptyStyleDef';

// (NEW) import generateClassId สำหรับทำ hash
import { generateClassId } from './hash';

export function processClassBlocks(
  scopeName: string,
  classBlocks: IClassBlock[],
  constMap: Map<string, IStyleDefinition>
): Map<string, IStyleDefinition> {
  const localClasses = new Set<string>();
  const result = new Map<string, IStyleDefinition>();

  for (const block of classBlocks) {
    const clsName = block.className;

    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // สร้าง styleDef เปล่า
    const classStyleDef = createEmptyStyleDef();

    // (A) แยก @query block
    const { queries, newBody } = extractQueryBlocks(block.body);
    const realQueryBlocks = queries.map((q) => ({
      selector: q.selector,
      styleDef: createEmptyStyleDef(),
    }));
    classStyleDef.queries = realQueryBlocks;

    // (B) parse line ปกติ + @use
    const lines = newBody
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let usedConstNames: string[] = [];
    const normalLines: string[] = [];

    for (const ln of lines) {
      if (ln.startsWith('@use ')) {
        if (usedConstNames.length > 0) {
          throw new Error(`[SWD-ERR] Multiple @use lines in ".${clsName}".`);
        }
        const tokens = ln.replace('@use', '').trim().split(/\s+/);
        usedConstNames = tokens;
      } else {
        normalLines.push(ln);
      }
    }

    if (usedConstNames.length > 0) {
      for (const cName of usedConstNames) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}".`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(classStyleDef, partialDef);
      }
    }

    // parse normal lines
    for (const ln of normalLines) {
      parseSingleAbbr(ln, classStyleDef);
    }

    // (C) parse ภายใน query
    for (let i = 0; i < realQueryBlocks.length; i++) {
      const qBlock = realQueryBlocks[i];
      const qRawBody = queries[i].rawBody;

      // copy localVars จาก parent -> qStyleDef
      if (!qBlock.styleDef.localVars) {
        qBlock.styleDef.localVars = {};
      }
      if (classStyleDef.localVars) {
        Object.assign(qBlock.styleDef.localVars, classStyleDef.localVars);
      }

      const qLines = qRawBody
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      let usedConstNamesQ: string[] = [];
      const normalQLines: string[] = [];

      for (const qLn of qLines) {
        if (qLn.startsWith('@use ')) {
          const tokens = qLn.replace('@use', '').trim().split(/\s+/);
          usedConstNamesQ.push(...tokens);
        } else {
          normalQLines.push(qLn);
        }
      }

      for (const cName of usedConstNamesQ) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use unknown const "${cName}" in @query block.`);
        }
        const partialDef = constMap.get(cName)!;
        if (partialDef.hasRuntimeVar) {
          throw new Error(
            `[SWD-ERR] @use "${cName}" has $variable, not allowed inside @query block.`
          );
        }
        mergeStyleDef(qBlock.styleDef, partialDef);
      }

      // parse normal lines ใน query
      for (const ln of normalQLines) {
        parseSingleAbbr(ln, qBlock.styleDef, false, true);
      }
    }

    // (D) ตรวจว่ามี local var ใช้ก่อนประกาศไหม
    if ((classStyleDef as any)._usedLocalVars) {
      for (const usedVar of (classStyleDef as any)._usedLocalVars) {
        if (!classStyleDef.localVars || !(usedVar in classStyleDef.localVars)) {
          throw new Error(
            `[SWD-ERR] local var "${usedVar}" is used but not declared in ".${clsName}" (scope="${scopeName}").`
          );
        }
      }
    }
    for (let i = 0; i < realQueryBlocks.length; i++) {
      const qStyleDef = realQueryBlocks[i].styleDef;
      if ((qStyleDef as any)._usedLocalVars) {
        for (const usedVar of (qStyleDef as any)._usedLocalVars) {
          if (!qStyleDef.localVars || !(usedVar in qStyleDef.localVars)) {
            const sel = queries[i].selector;
            throw new Error(
              `[SWD-ERR] local var "${usedVar}" is used but not declared in query "${sel}" of ".${clsName}".`
            );
          }
        }
      }
    }

    // (E) สร้าง finalKey ตาม scopeName
    let finalKey: string;

    if (scopeName === 'none') {
      // 1) scope=none => ใช้ชื่อคลาสล้วน
      finalKey = clsName;
    } else if (scopeName === 'hash') {
      // 2) scope=hash => เอา clsName + block.body => generateClassId => เช่น "box_abc123"
      const hashStr = clsName + block.body;
      const hashedPart = generateClassId(hashStr);
      finalKey = `${clsName}_${hashedPart}`;
    } else {
      // 3) scope=ปกติ => "myscope_box"
      finalKey = `${scopeName}_${clsName}`;
    }

    // เก็บลง map
    result.set(finalKey, classStyleDef);
  }

  return result;
}
