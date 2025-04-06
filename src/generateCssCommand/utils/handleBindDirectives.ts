import { IParsedDirective, IStyleDefinition } from '../types';

export function handleBindDirectives(
  scopeName: string,
  directives: IParsedDirective[],
  classMap: Map<string, IStyleDefinition>
) {
  const localBindKeys = new Set<string>();

  for (const d of directives) {
    if (d.name === 'bind') {
      const tokens = d.value.trim().split(/\s+/);
      if (tokens.length < 2) {
        throw new Error(`[SWD-ERR] Invalid @bind syntax: "${d.value}"`);
      }
      const bindKey = tokens[0];
      const classRefs = tokens.slice(1);

      if (localBindKeys.has(bindKey)) {
        throw new Error(`[SWD-ERR] @bind key "${bindKey}" is already used in this file.`);
      }
      localBindKeys.add(bindKey);

      for (const ref of classRefs) {
        if (!ref.startsWith('.')) {
          throw new Error(`[SWD-ERR] @bind usage must reference classes with a dot. got "${ref}"`);
        }
        const shortCls = ref.slice(1);
        const finalKey = scopeName === 'none' ? shortCls : `${scopeName}_${shortCls}`;
        if (classMap.has(`${scopeName}_${bindKey}`)) {
          throw new Error(
            `[SWD-ERR] @bind key "${bindKey}" conflicts with existing class ".${bindKey}" in styled (scope="${scopeName}").`
          );
        }
        if (!classMap.has(finalKey)) {
          throw new Error(
            `[SWD-ERR] @bind referencing ".${shortCls}" but that class is not defined.`
          );
        }

        // do nothing (หรือเก็บลง map ถ้าต้องการ)
      }
    }
  }
}
