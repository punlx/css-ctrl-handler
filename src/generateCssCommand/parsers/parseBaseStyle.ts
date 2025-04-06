import { abbrMap } from '../../constants';
import { globalTypographyDict } from '../../extension';
import { globalDefineMap } from '../createSwdCssCommand';
import { convertCSSVariable } from '../helpers/convertCSSVariable';
import { detectImportantSuffix } from '../helpers/detectImportantSuffix';
import { separateStyleAndProperties } from '../helpers/separateStyleAndProperties';
import { IStyleDefinition } from '../types';
import { mergeStyleDef } from '../utils/mergeStyleDef';
import { parseSingleAbbr } from './parseSingleAbbr';

/** parseBaseStyle **/
export function parseBaseStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false
) {
  const { line: abbrLineNoBang, isImportant } = detectImportantSuffix(abbrLine);
  if (isConstContext && isImportant) {
    throw new Error(
      `[SWD-ERR] !important is not allowed in @const (or theme.define) block. Found: "${abbrLine}"`
    );
  }

  const [styleAbbr, propValue] = separateStyleAndProperties(abbrLineNoBang);
  if (!styleAbbr) {
    return;
  }

  if (styleAbbr in abbrMap && styleAbbr in globalDefineMap) {
    throw new Error(
      `[SWD-ERR] "${styleAbbr}" is defined in both abbrMap and theme.define(...) - name collision not allowed.`
    );
  }

  if (styleAbbr.startsWith('--&')) {
    if (isConstContext) {
      throw new Error(
        `[SWD-ERR] Local var "${styleAbbr}" not allowed inside @const/theme.define block.`
      );
    }
    if (isQueryBlock) {
      throw new Error(`[SWD-ERR] Local var "${styleAbbr}" not allowed inside @query block.`);
    }
    if (isImportant) {
      throw new Error(`[SWD-ERR] !important is not allowed with local var "${styleAbbr}".`);
    }

    const localVarName = styleAbbr.slice(3);
    if (!localVarName) {
      throw new Error(
        `[SWD-ERR] Missing local var name after "--&". Usage: "--&<name>[value]" (abbrLine=${abbrLine})`
      );
    }

    if (!styleDef.localVars) {
      styleDef.localVars = {};
    }
    if (styleDef.localVars[localVarName] != null) {
      throw new Error(`[SWD-ERR] local var "${localVarName}" is already declared in this class.`);
    }
    styleDef.localVars[localVarName] = convertCSSVariable(propValue);
    return;
  }

  const isVariable = styleAbbr.startsWith('$');
  if (isVariable) {
    if (isQueryBlock) {
      throw new Error(
        `[SWD-ERR] Runtime variable ($var) not allowed inside @query block. Found: "${abbrLine}"`
      );
    }
    const realAbbr = styleAbbr.slice(1);
    if (realAbbr === 'ty') {
      throw new Error(`[SWD-ERR] "$ty[...]": cannot use runtime variable to reference typography.`);
    }
    const expansions = [`${realAbbr}[${propValue}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      if (val2.includes('--&')) {
        throw new Error(
          `[SWD-ERR] $variable is not allowed to reference local var (--&xxx). Found: "${abbrLine}"`
        );
      }

      const cssProp = abbrMap[abbr2 as keyof typeof abbrMap];
      if (!cssProp) {
        throw new Error(
          `[SWD-ERROR] "${abbr2}" not defined in style abbreviation. (abbrLine=${abbrLine})`
        );
      }
      const finalVal = convertCSSVariable(val2);

      if (!styleDef.varBase) {
        styleDef.varBase = {};
      }
      styleDef.varBase[realAbbr] = finalVal;

      styleDef.base[cssProp] = `var(--${realAbbr})${isImportant ? ' !important' : ''}`;
    }
    return;
  }

  // ------------------------------
  // (NEW) ถ้าเจอ ty[xxxx]
  // ------------------------------
  if (styleAbbr === 'ty') {
    const typKey = propValue.trim();
    if (!globalTypographyDict[typKey]) {
      throw new Error(
        `[SWD-ERR] Typography key "${typKey}" not found in theme.typography(...) (abbrLine=${abbrLine})`
      );
    }
    // สมมติ theme.typography['body-1'] => "fs[16px] fw[400] lh[1.5] fm[Sarabun-Regular]"
    const tokens = globalTypographyDict[typKey].split(/\s+/);
    for (const tk of tokens) {
      // parseSingleAbbr ซ้ำ จะเข้ามา parseBaseStyle อีกที
      parseSingleAbbr(tk, styleDef, false, isQueryBlock, false);
    }
    return;
  }

  // ------------------------------
  // ถ้า abbrMap ไม่มี => อาจเป็น define
  // ------------------------------
  if (!(styleAbbr in abbrMap)) {
    if (styleAbbr in globalDefineMap) {
      const tokens = propValue.split(/\s+/).filter(Boolean);
      if (tokens.length > 1) {
        throw new Error(
          `[SWD-ERR] Multiple subKey not allowed. Found: "${styleAbbr}[${propValue}]"`
        );
      }
      const subK = tokens[0];
      if (!subK) {
        throw new Error(`[SWD-ERR] Missing subKey for "${styleAbbr}[...]"`);
      }
      const partialDef = globalDefineMap[styleAbbr][subK];
      if (!partialDef) {
        throw new Error(`[SWD-ERR] "${styleAbbr}[${subK}]" not found in theme.define(...)`);
      }
      mergeStyleDef(styleDef, partialDef);
      return;
    }
    throw new Error(
      `"${styleAbbr}" not defined in style abbreviation or theme.define(...) (abbrLine=${abbrLine})`
    );
  }

  // ------------------------------
  // (เดิม) ถ้าอยู่ใน abbrMap => parse
  // ------------------------------
  const expansions = [`${styleAbbr}[${propValue}]`];
  for (const ex of expansions) {
    const [abbr2, val2] = separateStyleAndProperties(ex);
    if (!abbr2) continue;

    const cssProp = abbrMap[abbr2 as keyof typeof abbrMap];
    if (!cssProp) {
      throw new Error(
        `[SWD-ERR] "${abbr2}" not defined in style abbreviation. (abbrLine=${abbrLine})`
      );
    }

    let finalVal = convertCSSVariable(val2);
    if (val2.includes('--&')) {
      finalVal = val2.replace(/--&([\w-]+)/g, (_, varName) => {
        if (!(styleDef as any)._usedLocalVars) {
          (styleDef as any)._usedLocalVars = new Set<string>();
        }
        (styleDef as any)._usedLocalVars.add(varName);
        return `LOCALVAR(${varName})`;
      });
      styleDef.base[cssProp] = finalVal + (isImportant ? ' !important' : '');
    } else {
      styleDef.base[cssProp] = finalVal + (isImportant ? ' !important' : '');
    }
  }
}
