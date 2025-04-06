import { abbrMap } from '../../constants';
import { globalTypographyDict } from '../../extension';
import { convertCSSVariable } from '../helpers/convertCSSVariable';
import { detectImportantSuffix } from '../helpers/detectImportantSuffix';
import { separateStyleAndProperties } from '../helpers/separateStyleAndProperties';
import { IStyleDefinition } from '../types';

export function parsePseudoElementStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  const pseudoName = abbrLine.slice(0, openParenIdx).trim();
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();
  const propsInPseudo = inside.split(/ (?=[^\[\]]*(?:\[|$))/);

  const result: Record<string, string> = styleDef.pseudos[pseudoName] || {};
  styleDef.varPseudos = styleDef.varPseudos || {};
  styleDef.varPseudos[pseudoName] = styleDef.varPseudos[pseudoName] || {};

  for (const p of propsInPseudo) {
    const { line: tokenNoBang, isImportant } = detectImportantSuffix(p);
    if (isConstContext && isImportant) {
      throw new Error(`[CSS-CTRL-ERR] !important is not allowed in @const block. Found: "${abbrLine}"`);
    }
    const [abbr, val] = separateStyleAndProperties(tokenNoBang);
    if (!abbr) continue;

    if (abbr.includes('--&')) {
      const localVarMatches = abbr.match(/--&([\w-]+)/g) || [];
      for (const matchVar of localVarMatches) {
        const localVarName = matchVar.replace('--&', '');
        if (!styleDef.localVars?.[localVarName]) {
          throw new Error(
            `[CSS-CTRL-ERR] Using local var "${matchVar}" in pseudo ${pseudoName} before it is declared in base.`
          );
        }
      }
    }

    if (abbr.startsWith('--&') && isImportant) {
      throw new Error(
        `[CSS-CTRL-ERR] !important is not allowed with local var (${abbr}) in pseudo ${pseudoName}.`
      );
    }

    if (abbr === 'ct') {
      result['content'] = `"${val}"` + (isImportant ? ' !important' : '');
      continue;
    }

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;
      if (isVariable) {
        if (realAbbr === 'ty') {
          throw new Error(
            `[CSS-CTRL-ERR] "$ty[...]": cannot use runtime variable to reference typography.`
          );
        }
      }

      if (val2.includes('--&')) {
        const usedLocalVars = val2.match(/--&([\w-]+)/g) || [];
        for (const usage of usedLocalVars) {
          const localVarName = usage.replace('--&', '');
          if (!styleDef.localVars?.[localVarName]) {
            throw new Error(
              `[CSS-CTRL-ERR] Using local var "${usage}" in pseudo ${pseudoName} before it is declared in base.`
            );
          }
        }
      }

      // -------------------------------------------
      // (NEW) TODO ใช้ typography ใน pseudo
      // -------------------------------------------
      if (realAbbr === 'ty') {
        const typKey = val2.trim();
        if (!globalTypographyDict[typKey]) {
          throw new Error(
            `[CSS-CTRL-ERR] Typography key "${typKey}" not found in theme.typography(...) for pseudo ${pseudoName}.`
          );
        }
        // เช่น "fs[16px] fw[400] ..."
        const styleStr = globalTypographyDict[typKey];
        const tokens = styleStr.split(/\s+/);
        for (const tk of tokens) {
          // แตก token
          const { line: tkNoBang, isImportant: tkImp } = detectImportantSuffix(tk);
          const [subAbbr, subVal] = separateStyleAndProperties(tkNoBang);
          if (!subAbbr) continue;

          const cProp = abbrMap[subAbbr as keyof typeof abbrMap];
          if (!cProp) {
            throw new Error(
              `"${subAbbr}" not found in abbrMap (pseudo:${pseudoName}). (ty[${typKey}])`
            );
          }
          const finalVal = convertCSSVariable(subVal);
          // ใส่ใน pseudo
          result[cProp] = finalVal + (tkImp ? ' !important' : '');
        }
        continue;
      }

      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`[CSS-CTRL-ERR] "${realAbbr}" not found in abbrMap for pseudo-element ${pseudoName}.`);
      }

      const finalVal = convertCSSVariable(val2);
      if (isVariable) {
        styleDef.varPseudos[pseudoName]![realAbbr] = finalVal;
        result[cProp] = `var(--${realAbbr}-${pseudoName})` + (isImportant ? ' !important' : '');
      } else if (val2.includes('--&')) {
        const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
          return `LOCALVAR(${varName})`;
        });
        result[cProp] = replaced + (isImportant ? ' !important' : '');
      } else {
        result[cProp] = finalVal + (isImportant ? ' !important' : '');
      }
    }
  }

  styleDef.pseudos[pseudoName] = result;
}
