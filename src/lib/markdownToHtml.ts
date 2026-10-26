/**
 * markdownToHtml — one-way migration helper
 *
 * Converts the legacy InvestSuite markdown-marker format (as produced by the
 * v1 DocumentEditor) into clean HTML so it can be loaded into the new
 * @10play/tentap-editor (TipTap/WebView) editor.
 *
 * This is called ONCE per document on first open after the upgrade.
 * After migration the document is stored as HTML and this file is never
 * invoked again for that document.
 *
 * Detection: a string is considered "old markdown" when it does NOT start
 * with '<' (HTML) and is NOT valid JSON.  HTML documents already start with
 * a tag; TipTap JSON starts with '{'.
 *
 * Supported legacy markers (block):
 *   # text          → <h1>
 *   ## text         → <h2>
 *   ### text        → <h3>
 *   #### text       → <h4>
 *   ##### text      → <h5>
 *   ###### text     → <h6>
 *   :center: text   → <p style="text-align:center">
 *   :right: text    → <p style="text-align:right">
 *   :justify: text  → <p style="text-align:justify">
 *   :left: text     → (default left-aligned paragraph)
 *   > text          → <blockquote>
 *   • text          → <ul><li>
 *   - text          → <ul><li>
 *   1. text         → <ol><li>
 *   - [x] text      → <ul data-type="taskList"><li checked>
 *   - [ ] text      → <ul data-type="taskList"><li>
 *       text        → indented <p style="padding-left:2em">
 *   ---             → <hr>
 *   ```             → <pre><code> block fence
 *
 * Supported legacy markers (inline):
 *   **text**                 → <strong>
 *   *text*                   → <em>
 *   __text__                 → <u>
 *   ~~text~~                 → <s>
 *   `text`                   → <code>
 *   [color=#HEX]text[/color] → <span style="color:#HEX">
 *   [bg=#HEX]text[/bg]       → <span style="background-color:#HEX">
 *   [size=N]text[/size]      → <span style="font-size:Npt">
 *   [font=NAME]text[/font]   → <span style="font-family:NAME">
 *   [link text](url)         → <a href="url">link text</a>
 */

/** Detect whether a string is already HTML. */
export function isHtml(value: string): boolean {
  const t = value.trimStart();
  return t.startsWith('<') || t.startsWith('<!');
}

/** Detect whether a string is already TipTap JSON. */
export function isTipTapJson(value: string): boolean {
  const t = value.trimStart();
  if (!t.startsWith('{')) return false;
  try {
    const obj = JSON.parse(t) as Record<string, unknown>;
    return obj.type === 'doc';
  } catch {
    return false;
  }
}

/** Returns true when `value` needs migration (is old markdown). */
export function needsMigration(value: string): boolean {
  if (!value || !value.trim()) return false;
  return !isHtml(value) && !isTipTapJson(value);
}

// ─── Inline converter ─────────────────────────────────────────────────────────
function convertInline(raw: string): string {
  return raw
    // [color=#HEX]text[/color]
    .replace(/\[color=(#[0-9A-Fa-f]{3,8})\]([\s\S]*?)\[\/color\]/g,
      (_, hex, txt) => `<span style="color:${hex}">${txt}</span>`)
    // [bg=#HEX]text[/bg]
    .replace(/\[bg=(#[0-9A-Fa-f]{3,8})\]([\s\S]*?)\[\/bg\]/g,
      (_, hex, txt) => `<span style="background-color:${hex}">${txt}</span>`)
    // [size=N]text[/size]
    .replace(/\[size=(\d+(?:\.\d+)?)\]([\s\S]*?)\[\/size\]/g,
      (_, n, txt) => `<span style="font-size:${n}pt">${txt}</span>`)
    // [font=NAME]text[/font]
    .replace(/\[font=([^\]]+)\]([\s\S]*?)\[\/font\]/g,
      (_, name, txt) => `<span style="font-family:${name}">${txt}</span>`)
    // **bold**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // __underline__
    .replace(/__([^_]+)__/g, '<u>$1</u>')
    // ~~strike~~
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    // `inline code`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // *italic*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // [link text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// ─── Block converter ──────────────────────────────────────────────────────────
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '<p></p>';

  const rawLines = md.split('\n');
  const htmlParts: string[] = [];
  let i = 0;

  // List state tracking for proper <ul>/<ol>/<ul data-type="taskList"> wrapping
  type ListType = 'ul' | 'ol' | 'task';
  let openList: ListType | null = null;

  const closeList = () => {
    if (openList === 'ul')   { htmlParts.push('</ul>'); openList = null; }
    if (openList === 'ol')   { htmlParts.push('</ol>'); openList = null; }
    if (openList === 'task') { htmlParts.push('</ul>'); openList = null; }
  };

  const ensureList = (type: ListType) => {
    if (openList === type) return;
    closeList();
    if (type === 'ul')   htmlParts.push('<ul>');
    if (type === 'ol')   htmlParts.push('<ol>');
    if (type === 'task') htmlParts.push('<ul data-type="taskList">');
    openList = type;
  };

  while (i < rawLines.length) {
    const raw = rawLines[i];

    // ── Code block fence ────────────────────────────────────────────────
    if (raw.trim() === '```') {
      closeList();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && rawLines[i].trim() !== '```') {
        codeLines.push(rawLines[i]);
        i++;
      }
      htmlParts.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      i++; // skip closing ```
      continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────────────
    if (raw.trim() === '---') {
      closeList();
      htmlParts.push('<hr>');
      i++; continue;
    }

    // ── Alignment prefix ────────────────────────────────────────────────
    let align = '';
    let content = raw;
    if      (raw.startsWith(':center: '))  { align = 'center';  content = raw.slice(9);  }
    else if (raw.startsWith(':right: '))   { align = 'right';   content = raw.slice(8);  }
    else if (raw.startsWith(':justify: ')) { align = 'justify'; content = raw.slice(10); }
    else if (raw.startsWith(':left: '))    { align = '';         content = raw.slice(7);  }

    const alignAttr = align ? ` style="text-align:${align}"` : '';

    // ── Headings ────────────────────────────────────────────────────────
    if (content.startsWith('###### ')) {
      closeList();
      htmlParts.push(`<h6${alignAttr}>${convertInline(content.slice(7))}</h6>`);
      i++; continue;
    }
    if (content.startsWith('##### ')) {
      closeList();
      htmlParts.push(`<h5${alignAttr}>${convertInline(content.slice(6))}</h5>`);
      i++; continue;
    }
    if (content.startsWith('#### ')) {
      closeList();
      htmlParts.push(`<h4${alignAttr}>${convertInline(content.slice(5))}</h4>`);
      i++; continue;
    }
    if (content.startsWith('### ')) {
      closeList();
      htmlParts.push(`<h3${alignAttr}>${convertInline(content.slice(4))}</h3>`);
      i++; continue;
    }
    if (content.startsWith('## ')) {
      closeList();
      htmlParts.push(`<h2${alignAttr}>${convertInline(content.slice(3))}</h2>`);
      i++; continue;
    }
    if (content.startsWith('# ')) {
      closeList();
      htmlParts.push(`<h1${alignAttr}>${convertInline(content.slice(2))}</h1>`);
      i++; continue;
    }

    // ── Blockquote ──────────────────────────────────────────────────────
    if (content.startsWith('> ')) {
      closeList();
      htmlParts.push(`<blockquote><p>${convertInline(content.slice(2))}</p></blockquote>`);
      i++; continue;
    }

    // ── Checklist ───────────────────────────────────────────────────────
    if (content.startsWith('- [x] ') || content.startsWith('- [X] ')) {
      ensureList('task');
      htmlParts.push(`<li data-checked="true"><label><input type="checkbox" checked></label><div><p>${convertInline(content.slice(6))}</p></div></li>`);
      i++; continue;
    }
    if (content.startsWith('- [ ] ')) {
      ensureList('task');
      htmlParts.push(`<li data-checked="false"><label><input type="checkbox"></label><div><p>${convertInline(content.slice(6))}</p></div></li>`);
      i++; continue;
    }

    // ── Bullet list (• or -) ────────────────────────────────────────────
    if (content.startsWith('• ') || content.startsWith('- ')) {
      ensureList('ul');
      const txt = content.startsWith('• ') ? content.slice(2) : content.slice(2);
      htmlParts.push(`<li><p>${convertInline(txt)}</p></li>`);
      i++; continue;
    }

    // ── Ordered list ────────────────────────────────────────────────────
    const numMatch = /^(\d+)\. (.*)/.exec(content);
    if (numMatch) {
      ensureList('ol');
      // Keep the written number (a list must not continue another list's count).
      htmlParts.push(`<li value="${numMatch[1]}"><p>${convertInline(numMatch[2])}</p></li>`);
      i++; continue;
    }

    // ── Indented paragraph ──────────────────────────────────────────────
    if (content.startsWith('    ')) {
      closeList();
      htmlParts.push(`<p style="padding-left:2em">${convertInline(content.trim())}</p>`);
      i++; continue;
    }

    // ── Empty line ──────────────────────────────────────────────────────
    if (!content.trim()) {
      closeList();
      htmlParts.push('<p></p>');
      i++; continue;
    }

    // ── Normal paragraph ────────────────────────────────────────────────
    closeList();
    htmlParts.push(`<p${alignAttr}>${convertInline(content)}</p>`);
    i++;
  }

  closeList();
  return htmlParts.join('\n');
}
