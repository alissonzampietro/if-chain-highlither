/**
 * IfChainParser
 *
 * Walks backwards from a given line to find all `if` / `else if` conditions
 * that are ancestors of (i.e., contain) that line in their block body.
 *
 * Works on raw text — no full AST needed — using brace/indent tracking.
 * Supports: JS/TS, Python, Java, C/C++, C#, Go, Rust, PHP, Ruby, Swift, Kotlin.
 */

export interface IfCondition {
  /** 0-based line index in the document */
  lineIndex: number;
  /** The full text of the condition line, trimmed */
  text: string;
  /** Nesting depth (0 = outermost ancestor) */
  depth: number;
  /** "if" | "else if" | "elif" | "unless" */
  kind: "if" | "else if" | "elif" | "unless" | "when";
}

// Languages that use indentation instead of braces
const INDENT_BASED_LANGS = new Set(["python", "ruby", "coffeescript", "yaml"]);

// Patterns for if/elif/unless/when keywords
const IF_PATTERN =
  /^\s*(else\s+if|elif|unless|when|else\s*\{|if)\s*[\(\s]/i;
const PURE_ELSE_PATTERN = /^\s*else\s*[\{:]?\s*$/;

export function parseIfChain(
  lines: string[],
  cursorLine: number,
  languageId: string
): IfCondition[] {
  const isIndentBased = INDENT_BASED_LANGS.has(languageId);

  return isIndentBased
    ? parseIndentBased(lines, cursorLine)
    : parseBraceBased(lines, cursorLine);
}

/**
 * Brace-based languages: track `{}` depth to find the block
 * that contains the cursor line, then look for the `if` that opened it.
 */
function parseBraceBased(lines: string[], cursorLine: number): IfCondition[] {
  const results: IfCondition[] = [];

  // Walk upward from the line above the cursor
  let braceDepth = 0;
  let depth = 0;

  for (let i = cursorLine - 1; i >= 0; i--) {
    const line = lines[i];

    // Count braces on this line (right-to-left so closing braces on the same
    // line as an `if` don't immediately swallow it)
    for (let c = line.length - 1; c >= 0; c--) {
      const ch = line[c];
      if (ch === "}") {
        braceDepth++;
      } else if (ch === "{") {
        if (braceDepth > 0) {
          braceDepth--;
        } else {
          // We've exited a block — check the line(s) above for the `if`
          const ifLine = findIfLineAbove(lines, i);
          if (ifLine !== null) {
            const kind = detectKind(lines[ifLine.lineIndex]);
            // Skip plain `else` blocks — they're not conditions leading to us
            if (kind !== null) {
              results.unshift({
                lineIndex: ifLine.lineIndex,
                text: ifLine.text,
                depth,
                kind,
              });
              depth++;
            }
          }
        }
      }
    }
  }

  // Re-assign depths so 0 = outermost
  return results.map((r, idx) => ({ ...r, depth: idx }));
}

/**
 * Looks from line `i` upward (skipping blank lines) to find the `if` /
 * `else if` that owns the `{` we just processed.
 * Also handles cases like:
 *   } else if (...) {
 *   } else {
 */
function findIfLineAbove(
  lines: string[],
  braceLineIdx: number
): { lineIndex: number; text: string } | null {
  // The `{` might be on the same line as the if, or on the next line (Allman style)
  for (let i = braceLineIdx; i >= Math.max(0, braceLineIdx - 3); i--) {
    const trimmed = lines[i].trim();
    if (IF_PATTERN.test(trimmed) || PURE_ELSE_PATTERN.test(trimmed)) {
      return { lineIndex: i, text: trimmed };
    }
    // Stop if we hit something clearly unrelated (non-blank, non-comment line
    // that isn't an `if`-related keyword)
    if (i !== braceLineIdx && trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
      break;
    }
  }
  return null;
}

/**
 * Indent-based languages: compare indentation levels.
 */
function parseIndentBased(lines: string[], cursorLine: number): IfCondition[] {
  const results: IfCondition[] = [];
  const cursorIndent = getIndent(lines[cursorLine]);

  let minIndent = cursorIndent;

  for (let i = cursorLine - 1; i >= 0; i--) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const indent = getIndent(line);

    if (indent < minIndent) {
      minIndent = indent;
      const kind = detectKind(trimmed);
      if (kind !== null) {
        results.unshift({ lineIndex: i, text: trimmed, depth: 0, kind });
      }
    }
  }

  return results.map((r, idx) => ({ ...r, depth: idx }));
}

function getIndent(line: string): number {
  let spaces = 0;
  for (const ch of line) {
    if (ch === " ") spaces++;
    else if (ch === "\t") spaces += 4;
    else break;
  }
  return spaces;
}

function detectKind(
  text: string
): "if" | "else if" | "elif" | "unless" | "when" | null {
  const t = text.trim().toLowerCase();
  if (/^else\s+if\b/.test(t)) return "else if";
  if (/^elif\b/.test(t)) return "elif";
  if (/^unless\b/.test(t)) return "unless";
  if (/^when\b/.test(t)) return "when";
  if (/^if\b/.test(t)) return "if";
  return null;
}
