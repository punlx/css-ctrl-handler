# Styledwind Intellisense

A VSCode extension that provides autocompletion (Intellisense) for [**Styledwind**](https://github.com/punlx/styledwind-intellisense) in `*.swd.ts` files. It parses abbreviations like `bg[`, `c[`, `bd[`, etc., and also automatically detects and reads your `styledwind.theme.ts` file to suggest color variables (e.g., `--blue-100`) upon typing `--`.

## Features

1. **Bracket-Based Property Suggestions**

   - When you type `bg[`, `c[`, `jc[`, etc. in a `.swd.ts` file, this extension will suggest CSS values defined in its internal map or your custom definitions.
   - For example, typing `bg[` will list color values like `red`, `blue`, `green`, etc.

2. **Automatic Theme Detection**

   - The extension searches for `styledwind.theme.ts` in your project.
   - Once found, it parses the file to extract color names in the first column of the palette array (skipping the first row used for mode names).
   - You can then type `--` inside `[ ... ]` to get suggestions like `--blue-100`, `--green-300`, and so on.

3. **Dynamic Color Suggestions**

   - Wherever you type `--` (for example, in `bg[--` or `bd[1px solid --`), the extension will suggest color variables loaded from your theme file.
   - No additional configuration is needed if your `styledwind.theme.ts` is located at the project root (or not deeply nested).

4. **No Extra Language Setup**
   - By default, `.swd.ts` files are treated as TypeScript (with `"files.associations": { "*.swd.ts": "typescript" }` in your VSCode settings).
   - The extension only triggers autocompletion for files ending with `.swd.ts`.

## Installation

1. Clone or download this extension repository (or install from the VSIX if provided).
2. Open the folder containing the extension in VSCode.
3. Run `npm install` to install dependencies, then `npm run compile` (if needed).
4. Press `F5` to launch a new VSCode Extension Development Host with the extension active.

_(Alternatively, if you have a `.vsix` package, install it in VSCode via “Extensions: Install from VSIX...”)_

## Usage

1. Make sure you have a `styledwind.theme.ts` file in your project root (or somewhere discoverable by the extension). For example:

   ```ts
   export const palette = theme.palette([
     ['dark', 'light', 'dim'],
     ['blue-100', '#E3F2FD', '#BBDEFB', '#90CAF9'],
     ['blue-200', '#64B5F6', '#42A5F5', '#2196F3'],
     ...
   ]);
   ```

2. In any \*.swd.ts file:

   - Type something like:

   ```ts
   .box {
     bg[
   }
   ```

   You will see suggestions for background-color values, e.g. red, blue, green, etc.

   - Type -- anywhere inside [...], such as bg[-- or bd[1px solid --, to see color variables like --blue-100, --green-200 from your theme file.

3. The extension automatically updates suggestions if you move or rename your styledwind.theme.ts. If you have multiple files named styledwind.theme.ts, it picks the first one it finds in the workspace.

# FAQ

**Why do I need "files.associations": { "\*.swd.ts": "typescript" }"?** VSCode does not recognize \*.swd.tsas TypeScript out of the box. By associating it withtypescript`, you get proper syntax highlighting and TS language features.

What if my theme file structure differs from the default pattern?
The extension uses a regex approach to parse theme.palette([...]). If your code significantly deviates from the default array format, you might need to modify the parsing logic in the extension code.

Can I disable certain property completions?
Yes. You can remove or modify entries in the cssValues map in the extension source to stop it from suggesting specific properties (e.g., removing border suggestions).
