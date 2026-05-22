import * as vscode from "vscode";
import { parseIfChain, IfCondition } from "./parser";

// ─── Decoration types ────────────────────────────────────────────────────────

let highlightDecoration: vscode.TextEditorDecorationType;
let gutterDecoration: vscode.TextEditorDecorationType;
let currentLineDecoration: vscode.TextEditorDecorationType;
let statusBarItem: vscode.StatusBarItem;

// ─── State ───────────────────────────────────────────────────────────────────

let enabled = true;
let lastChain: IfCondition[] = [];

// ─── Activation ──────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  console.log("If Chain Highlighter is active");

  buildDecorations();

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "ifChainHighlighter.toggle";
  statusBarItem.tooltip = "If Chain Highlighter — click to toggle";
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ifChainHighlighter.toggle", () => {
      enabled = !enabled;
      if (!enabled) {
        clearDecorations();
        updateStatusBar(0, false);
      } else {
        triggerUpdate();
      }
      vscode.window.showInformationMessage(
        `If Chain Highlighter: ${enabled ? "enabled ✓" : "disabled"}`
      );
    }),

    vscode.commands.registerCommand("ifChainHighlighter.showChain", () => {
      showChainPanel(lastChain);
    })
  );

  // React to cursor movement & document changes
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(onSelectionChange),
    vscode.window.onDidChangeActiveTextEditor(onEditorChange),
    vscode.workspace.onDidChangeConfiguration(onConfigChange),
    vscode.workspace.onDidChangeTextDocument(() => triggerUpdate())
  );

  // Initial highlight
  triggerUpdate();
}

export function deactivate() {
  clearDecorations();
  statusBarItem?.dispose();
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

function triggerUpdate() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !enabled) return;
  updateHighlights(editor);
}

function updateHighlights(editor: vscode.TextEditor) {
  const doc = editor.document;
  const cursor = editor.selection.active;
  const lines = Array.from({ length: doc.lineCount }, (_, i) =>
    doc.lineAt(i).text
  );

  const chain = parseIfChain(lines, cursor.line, doc.languageId);
  lastChain = chain;

  const cfg = vscode.workspace.getConfiguration("ifChainHighlighter");
  const showGutter = cfg.get<boolean>("showGutterIcons", true);

  // Build ranges for the highlight decoration
  const highlightRanges: vscode.DecorationOptions[] = chain.map((cond) => {
    const line = doc.lineAt(cond.lineIndex);
    const range = line.range;
    const depthLabel = chain.length === 1 ? "1 level" : `${cond.depth + 1}/${chain.length}`;
    return {
      range,
      hoverMessage: new vscode.MarkdownString(
        `**If Chain** — depth ${depthLabel}\n\n\`${cond.text}\``
      ),
      renderOptions: {
        before: showGutter
          ? {
              contentText: getDepthIcon(cond.depth, chain.length),
              color: "rgba(255,200,0,0.9)",
              margin: "0 6px 0 0",
              fontWeight: "bold",
            }
          : undefined,
      },
    };
  });

  // Current-line decoration: show the path summary inline
  const currentLineRange = doc.lineAt(cursor.line).range;
  const currentLineOpts: vscode.DecorationOptions[] = [];
  if (chain.length > 0) {
    currentLineOpts.push({
      range: currentLineRange,
      renderOptions: {
        after: {
          contentText:
            chain.length === 1
              ? `  ← inside 1 if`
              : `  ← inside ${chain.length} nested ifs`,
          color: "rgba(255,200,0,0.5)",
          fontStyle: "italic",
          margin: "0 0 0 12px",
        },
      },
    });
  }

  editor.setDecorations(highlightDecoration, highlightRanges);
  editor.setDecorations(currentLineDecoration, currentLineOpts);

  // Status bar
  const showStatus = cfg.get<boolean>("showStatusBar", true);
  if (showStatus) {
    updateStatusBar(chain.length, true);
  } else {
    statusBarItem.hide();
  }
}

function clearDecorations() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    editor.setDecorations(highlightDecoration, []);
    editor.setDecorations(currentLineDecoration, []);
  }
}

// ─── Decoration Factory ───────────────────────────────────────────────────────

function buildDecorations() {
  const cfg = vscode.workspace.getConfiguration("ifChainHighlighter");
  const bgColor = cfg.get<string>(
    "highlightColor",
    "rgba(255, 200, 0, 0.18)"
  );
  const borderCol = cfg.get<string>(
    "borderColor",
    "rgba(255, 200, 0, 0.7)"
  );

  highlightDecoration?.dispose();
  currentLineDecoration?.dispose();

  highlightDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    borderRadius: "3px",
    overviewRulerColor: borderCol,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    isWholeLine: true,
    light: {
      backgroundColor: "rgba(200, 150, 0, 0.15)",
      borderColor: "rgba(180, 130, 0, 0.6)",
    },
    dark: {
      backgroundColor: bgColor,
    },
  });

  currentLineDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
  });
}

// ─── Status Bar ───────────────────────────────────────────────────────────────

function updateStatusBar(chainDepth: number, show: boolean) {
  if (!show) {
    statusBarItem.hide();
    return;
  }
  if (chainDepth === 0) {
    statusBarItem.text = "$(list-flat) No if chain";
    statusBarItem.color = undefined;
  } else {
    const icons = "⬡".repeat(Math.min(chainDepth, 5));
    statusBarItem.text = `$(list-tree) ${icons} ${chainDepth} nested if${chainDepth > 1 ? "s" : ""}`;
    statusBarItem.color = new vscode.ThemeColor(
      "charts.yellow"
    );
  }
  statusBarItem.show();
}

// ─── Chain Panel ──────────────────────────────────────────────────────────────

async function showChainPanel(chain: IfCondition[]) {
  if (chain.length === 0) {
    vscode.window.showInformationMessage(
      "If Chain Highlighter: no if conditions lead to the current line."
    );
    return;
  }

  const items: vscode.QuickPickItem[] = chain.map((cond, idx) => ({
    label: `${getDepthIcon(idx, chain.length)} ${cond.text}`,
    description: `Line ${cond.lineIndex + 1}`,
    detail:
      idx === 0
        ? "Outermost condition"
        : idx === chain.length - 1
        ? "Innermost condition (closest to cursor)"
        : `Depth ${idx + 1}`,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: `If Chain — ${chain.length} condition${chain.length > 1 ? "s" : ""} lead to your cursor`,
    placeHolder: "Select a condition to jump to it",
  });

  if (picked) {
    const idx = items.indexOf(picked);
    const lineIndex = chain[idx].lineIndex;
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const position = new vscode.Position(lineIndex, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDepthIcon(depth: number, total: number): string {
  if (total === 1) return "◆ if";
  if (depth === 0) return "⊕ if";
  if (depth === total - 1) return "▸ if";
  return "◈ if";
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

function onSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
  if (!enabled) return;
  updateHighlights(e.textEditor);
}

function onEditorChange(editor: vscode.TextEditor | undefined) {
  if (!editor || !enabled) return;
  updateHighlights(editor);
}

function onConfigChange(e: vscode.ConfigurationChangeEvent) {
  if (e.affectsConfiguration("ifChainHighlighter")) {
    buildDecorations();
    triggerUpdate();
  }
}
