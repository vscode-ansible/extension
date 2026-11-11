/**
 * Theme-adaptive helpers shared by all webviews.
 *
 * Webviews must pull colors exclusively from VS Code theme CSS variables so
 * they follow the active color theme (light/dark/high-contrast). We never emit
 * hardcoded hex in webview bodies.
 */

/** A compact `:root` style block mapping commonly used roles to VS Code vars. */
export function themeCss(): string {
  return `
  :root {
    color-scheme: light dark;
    --tk-bg: var(--vscode-editor-background);
    --tk-fg: var(--vscode-foreground);
    --tk-muted: var(--vscode-descriptionForeground);
    --tk-border: var(--vscode-panel-border, var(--vscode-widget-border));
    --tk-input-bg: var(--vscode-input-background);
    --tk-input-fg: var(--vscode-input-foreground);
    --tk-input-border: var(--vscode-input-border, var(--vscode-widget-border));
    --tk-btn-bg: var(--vscode-button-background);
    --tk-btn-fg: var(--vscode-button-foreground);
    --tk-btn-hover: var(--vscode-button-hoverBackground);
    --tk-btn-secondary-bg: var(--vscode-button-secondaryBackground);
    --tk-btn-secondary-fg: var(--vscode-button-secondaryForeground);
    --tk-btn-secondary-hover: var(--vscode-button-secondaryHoverBackground);
    --tk-focus: var(--vscode-focusBorder);
    --tk-accent: var(--vscode-focusBorder, var(--vscode-textLink-foreground));
    --tk-error: var(--vscode-errorForeground);
    --tk-ok: var(--vscode-charts-green, var(--vscode-testing-iconPassed));
    --tk-warn: var(--vscode-charts-yellow, var(--vscode-editorWarning-foreground));
    --tk-info: var(--vscode-charts-blue, var(--vscode-textLink-foreground));
    --tk-font: var(--vscode-font-family);
    --tk-font-size: var(--vscode-font-size);
    --tk-mono: var(--vscode-editor-font-family, ui-monospace, monospace);
  }`.trim();
}

/** Maps a runtime status token to a semantic CSS variable (no hex). */
export function statusColorVar(status: string): string {
  switch (status) {
    case 'ok':
      return 'var(--vscode-charts-green)';
    case 'changed':
      return 'var(--vscode-charts-yellow)';
    case 'failed':
    case 'unreachable':
      return 'var(--vscode-errorForeground)';
    case 'skipped':
      return 'var(--vscode-charts-blue)';
    case 'ignored':
      return 'var(--vscode-descriptionForeground)';
    default:
      return 'var(--vscode-foreground)';
  }
}
