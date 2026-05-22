# If Chain Highlighter

> See every `if` condition that led your code to the line you're on.

---

<a href="https://marketplace.visualstudio.com/items?itemName=AlissonRodrigues.if-chain-highlighter" target="_blank">Download Here</a>


## What it does

When your cursor sits inside nested `if` / `else if` blocks, this extension **highlights every ancestor condition** that must be true for execution to reach your current line. The deeper you are, the more conditions light up.

```js
if (user.isLoggedIn) {          // ◆ highlighted — outermost
  if (user.role === 'admin') {  // ◆ highlighted
    if (featureFlag.enabled) {  // ◆ highlighted — closest
      // 👆 YOUR CURSOR HERE
      doSomething();
    }
  }
}
```

A small annotation also appears inline on your cursor line:
```
      doSomething();  ← inside 3 nested ifs
```

---

## Features

| Feature | Details |
|---|---|
| **Live highlights** | Updates as you move your cursor |
| **Status bar** | Shows nesting depth at a glance |
| **Jump to condition** | `Cmd/Ctrl+Alt+I` opens a picker — select any ancestor `if` to jump to it |
| **Toggle** | Same shortcut when picker is not needed; or use the command palette |
| **Multi-language** | JS, TS, JSX, TSX, Java, C, C++, C#, Go, Rust, PHP, Python, Ruby, Swift, Kotlin, and more |
| **Customizable colors** | Full control via settings |

---

## Getting Started

### Install from source

```bash
# 1. Clone or download this repo
git clone https://github.com/alissonzampietro/if-chain-highlighter

# 2. Install dependencies
cd if-chain-highlighter
npm install

# 3. Compile
npm run compile

# 4. Open in VS Code and press F5 to launch Extension Development Host
code .
```

### Install as a .vsix

```bash
npm install -g @vscode/vsce
vsce package
# Install the generated .vsix via: Extensions → ··· → Install from VSIX
```

---

## Keyboard Shortcut

| Action | Windows/Linux | macOS |
|---|---|---|
| Toggle / Jump picker | `Ctrl+Alt+I` | `Cmd+Alt+I` |

---

## Settings

All settings live under `ifChainHighlighter.*`:

| Setting | Default | Description |
|---|---|---|
| `enabled` | `true` | Enable/disable highlighting |
| `highlightColor` | `rgba(255,200,0,0.25)` | Background of highlighted `if` lines |
| `borderColor` | `rgba(255,200,0,0.8)` | Overview ruler color |
| `showGutterIcons` | `true` | Prefix icons in the editor gutter area |
| `showStatusBar` | `true` | Show nesting depth in the status bar |

Example `settings.json`:
```json
{
  "ifChainHighlighter.highlightColor": "rgba(100, 200, 255, 0.2)",
  "ifChainHighlighter.borderColor":    "rgba(100, 200, 255, 0.8)"
}
```

---

## How it works

The parser walks **upward** from the cursor line, tracking `{}` brace depth (for brace-based languages) or indentation level (for Python/Ruby). Each time it exits a block, it searches for the `if` / `else if` / `elif` that opened it, building an ordered chain from outermost to innermost.

No full AST is needed — it works on raw text, so it's instant even in large files.

---

## Supported Languages

Brace-based (automatic): JavaScript, TypeScript, JSX/TSX, Java, C, C++, C#, Go, Rust, PHP, Swift, Kotlin, Scala, Dart, and any language that uses `{}` for blocks.

Indent-based: Python, Ruby, CoffeeScript.

---

## License

MIT
