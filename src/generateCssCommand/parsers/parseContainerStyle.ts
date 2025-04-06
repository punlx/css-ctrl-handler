import { abbrMap } from '../../constants';
import { globalBreakpointDict, globalTypographyDict } from '../../extension';
import { convertCSSVariable } from '../helpers/convertCSSVariable';
import { detectImportantSuffix } from '../helpers/detectImportantSuffix';
import { separateStyleAndProperties } from '../helpers/separateStyleAndProperties';
import { IStyleDefinition } from '../types';
import { parseSingleAbbr } from './parseSingleAbbr'; // ใช้เรียกซ้ำ ถ้าต้องการ

export function parseContainerStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  let inside = abbrLine.slice(openParenIdx + 1, -1).trim();
  const commaIdx = inside.indexOf(',');
  if (commaIdx === -1) {
    throw new Error(`[SWD-ERR] "container" syntax error: ${abbrLine}`);
  }

  let containerPart = inside.slice(0, commaIdx).trim();
  const propsPart = inside.slice(commaIdx + 1).trim();

  // เช็ค breakpoint dict (TODO เดิม)
  if (!(containerPart.startsWith('min') || containerPart.startsWith('max'))) {
    if (globalBreakpointDict[containerPart]) {
      containerPart = globalBreakpointDict[containerPart];
    } else {
      throw new Error(
        `[SWD-ERR] unknown breakpoint key "${containerPart}" not found in theme.breakpoint(...) for container(...)`
      );
    }
  }

  const bracketOpen = containerPart.indexOf('[');
  const bracketClose = containerPart.indexOf(']');
  if (bracketOpen === -1 || bracketClose === -1) {
    throw new Error(`[SWD-ERR] "container" must contain e.g. min-w[600px]. Got ${containerPart}`);
  }

  const cAbbr = containerPart.slice(0, bracketOpen).trim();
  const cValue = containerPart.slice(bracketOpen + 1, bracketClose).trim();
  const cProp = abbrMap[cAbbr as keyof typeof abbrMap];
  if (!cProp) {
    throw new Error(`[SWD-ERR] "${cAbbr}" not found in abbrMap for container.`);
  }

  const containerQuery = `(${cProp}:${cValue})`;
  const propsList = propsPart.split(/ (?=[^\[\]]*(?:\[|$))/);

  const containerProps: Record<string, string> = {};

  for (const p of propsList) {
    const { line: tokenNoBang, isImportant } = detectImportantSuffix(p);
    if (isConstContext && isImportant) {
      throw new Error(`[SWD-ERR] !important is not allowed in @const block. Found: "${abbrLine}"`);
    }

    const [abbr, val] = separateStyleAndProperties(tokenNoBang);
    if (!abbr) continue;
    const isVar = abbr.startsWith('$');
    if (isVar) {
      throw new Error(`[SWD-ERR] $variable cannot use in container. Found: "${abbrLine}"`);
    }
    // ตรวจ local var, etc. (เหมือนเดิม)
    if (abbr.includes('--&')) {
      const localVarMatches = abbr.match(/--&([\w-]+)/g) || [];
      for (const matchVar of localVarMatches) {
        const localVarName = matchVar.replace('--&', '');
        if (!styleDef.localVars?.[localVarName]) {
          throw new Error(
            `[SWD-ERR] Using local var "${matchVar}" in container(...) before it is declared in base.`
          );
        }
      }
    }

    // แตก expansions
    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      // -------------------------------------------
      // (NEW) TODO ใช้ typography ใน container
      // -------------------------------------------
      if (abbr2 === 'ty') {
        const typKey = val2.trim();
        if (!globalTypographyDict[typKey]) {
          throw new Error(
            `[SWD-ERR] Typography key "${typKey}" not found in theme.typography(...) (container).`
          );
        }
        // เช่น "fs[16px] fw[400] ..."
        const styleStr = globalTypographyDict[typKey];
        // แตกเป็น token ย่อย
        const tokens = styleStr.split(/\s+/);
        for (const tk of tokens) {
          // แต่ละ token เช่น "fs[16px]"
          const { line: tkNoBang, isImportant: tkImp } = detectImportantSuffix(tk);
          const [subAbbr, subVal] = separateStyleAndProperties(tkNoBang);

          if (!subAbbr) continue;

          const cProp2 = abbrMap[subAbbr as keyof typeof abbrMap];
          if (!cProp2) {
            throw new Error(`[SWD-ERR] "${subAbbr}" not found in abbrMap (container). (ty[${typKey}])`);
          }
          let finalVal = convertCSSVariable(subVal);
          containerProps[cProp2] = finalVal + (tkImp ? ' !important' : '');
        }
        continue;
      }

      // -------------------------------------------
      // กรณีปกติ
      // -------------------------------------------
      if (abbr2.startsWith('--&') && isImportant) {
        throw new Error(
          `[SWD-ERR] !important is not allowed with local var (${abbr2}) in container.`
        );
      }

      if (val2.includes('--&')) {
        const usedLocalVars = val2.match(/--&([\w-]+)/g) || [];
        for (const usage of usedLocalVars) {
          const localVarName = usage.replace('--&', '');
          if (!styleDef.localVars?.[localVarName]) {
            throw new Error(
              `[SWD-ERR] Using local var "${usage}" in container(...) before it is declared in base.`
            );
          }
        }
      }

      const cProp2 = abbrMap[abbr2 as keyof typeof abbrMap];
      if (!cProp2) {
        throw new Error(`[SWD-ERR] "${abbr2}" not found in abbrMap (container).`);
      }
      if (val2.includes('--&')) {
        const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
          return `LOCALVAR(${varName})`;
        });
        containerProps[cProp2] = replaced + (isImportant ? ' !important' : '');
      } else {
        containerProps[cProp2] = convertCSSVariable(val2) + (isImportant ? ' !important' : '');
      }
    }
  }

  styleDef.containers.push({
    query: containerQuery,
    props: containerProps,
  });
}
