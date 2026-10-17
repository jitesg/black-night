/**
 * formatSection.ts
 *
 * Typesetting and structured parsing for statutory section text.
 * Visual formatting ONLY — zero mutation of the official wording, numbers,
 * punctuation, or sequence.
 */

import { logger } from '../logger';

export type Block =
  | { type: 'sub'; label: string; text: string; raw?: string }
  | { type: 'clause'; label: string; text: string; raw?: string }
  | { type: 'subclause'; label: string; text: string; raw?: string }
  | { type: 'proviso'; label?: string; text: string; raw?: string }
  | { type: 'explanation'; label: string; text: string; raw?: string }
  | { type: 'exception'; label: string; text: string; raw?: string }
  | {
      type: 'illustrations';
      heading?: string;
      items: Array<{ label: string; text: string; raw?: string }>;
      raw?: string;
    }
  | { type: 'note'; label?: string; text: string; raw?: string }
  | { type: 'para'; text: string; raw?: string };

/**
 * Normalizes all whitespace runs into a single space and trims.
 * Also standardizes hyphen-newline wraps so that words split across lines
 * match their joined representation.
 */
export function normalizeWs(s: string): string {
  return s
    .replace(/-\s+([a-z])/g, '-$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reconstructs continuous text from blocks for self-check validation.
 */
export function blocksToText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === 'illustrations') {
      if (b.heading) parts.push(b.heading);
      for (const it of b.items) {
        parts.push(it.raw || (it.label ? `${it.label} ${it.text}` : it.text));
      }
    } else {
      const label = 'label' in b && typeof b.label === 'string' ? b.label : '';
      parts.push(b.raw || (label ? `${label} ${b.text}` : b.text));
    }
  }
  return parts.join(' ');
}

/**
 * Asserts the concatenation of all block texts (whitespace-normalized)
 * strictly equals the whitespace-normalized original.
 */
export function selfCheck(blocks: Block[], originalText: string): boolean {
  if (!originalText || !originalText.trim()) return blocks.length === 0;
  const normOrig = normalizeWs(originalText);
  const normBlocks = normalizeWs(blocksToText(blocks));
  return normOrig === normBlocks;
}

/**
 * Parse raw section text with hard line wraps into structured blocks:
 * sub-sections, clauses, sub-clauses, provisos, explanations,
 * exceptions, illustrations, notes, and paragraphs.
 */
export function parseSectionText(rawText: string): Block[] {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText.split('\n');
  const lineGroups: string[][] = [];
  let currentGroup: string[] | null = null;

  function isMarker(line: string, inIllustrations: boolean): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // Sub-section: (1), (2), (2A)...
    if (/^\((\d+[A-Z]?)\)/.test(trimmed)) return true;

    // Illustrations heading
    if (/^Illustrations?([.—–:]|\s*$)/i.test(trimmed)) return true;

    // Exception
    if (/^Exception(\s+\d+)?[.—–:]?/i.test(trimmed)) return true;

    // Explanation
    if (/^Explanation(\s+\d+)?[.—–:]?/i.test(trimmed)) return true;

    // Proviso
    if (/^Provided\s+(that|further|also)/i.test(trimmed)) return true;

    // Note
    if (/^Note(\s+\d+)?[.—–:]?/i.test(trimmed)) return true;

    // When inside illustrations group, items (a), (b) or 1., 2. start new item
    if (inIllustrations) {
      if (/^\(([a-z]{1,2}|\d+)\)/i.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        return true;
      }
    }

    // Roman sub-clause (i), (ii), etc.
    if (/^\((i{1,3}|iv|v|vi{0,3}|ix|x)\)\s/i.test(trimmed)) return true;

    // Alphabetic clause (a), (b), (aa)...
    if (/^\(([a-z]{1,2})\)\s/i.test(trimmed)) return true;

    return false;
  }

  let inIllustrations = false;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Exit illustrations when encountering major section markers
    if (inIllustrations) {
      if (
        /^\((\d+[A-Z]?)\)/.test(trimmed) ||
        /^Exception(\s+\d+)?[.—–:]?/i.test(trimmed) ||
        /^Explanation(\s+\d+)?[.—–:]?/i.test(trimmed) ||
        /^Provided\s+(that|further|also)/i.test(trimmed)
      ) {
        inIllustrations = false;
      }
    }

    if (/^Illustrations?([.—–:]|\s*$)/i.test(trimmed)) {
      inIllustrations = true;
    }

    if (!currentGroup) {
      currentGroup = [trimmed];
    } else if (isMarker(trimmed, inIllustrations)) {
      lineGroups.push(currentGroup);
      currentGroup = [trimmed];
    } else {
      currentGroup.push(trimmed);
    }
  }

  if (currentGroup && currentGroup.length > 0) {
    lineGroups.push(currentGroup);
  }

  function joinLines(lines: string[]): string {
    let result = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0) {
        result = line;
      } else {
        const prev = lines[i - 1];
        if (prev.endsWith('-') && /^[a-z]/.test(line)) {
          // Hyphen-wrap: keep hyphen, join without space
          result += line;
        } else {
          result += ` ${line}`;
        }
      }
    }
    return result;
  }

  const blocks: Block[] = [];
  let currentIllustrationBlock: (Block & { type: 'illustrations' }) | null = null;

  for (const group of lineGroups) {
    const combinedText = joinLines(group);

    // Exception
    const excMatch = combinedText.match(/^(Exception\s*\d*[.—–-]*\s*)(.*)$/i);
    if (excMatch) {
      if (currentIllustrationBlock) {
        blocks.push(currentIllustrationBlock);
        currentIllustrationBlock = null;
      }
      blocks.push({
        type: 'exception',
        label: excMatch[1].trim(),
        text: excMatch[2].trim(),
        raw: combinedText,
      });
      continue;
    }

    // Explanation
    const expMatch = combinedText.match(/^(Explanation\s*\d*[.—–-]*\s*)(.*)$/i);
    if (expMatch) {
      if (currentIllustrationBlock) {
        blocks.push(currentIllustrationBlock);
        currentIllustrationBlock = null;
      }
      blocks.push({
        type: 'explanation',
        label: expMatch[1].trim(),
        text: expMatch[2].trim(),
        raw: combinedText,
      });
      continue;
    }

    // Proviso
    if (/^Provided\s+(that|further|also)/i.test(combinedText)) {
      if (currentIllustrationBlock) {
        blocks.push(currentIllustrationBlock);
        currentIllustrationBlock = null;
      }
      blocks.push({
        type: 'proviso',
        label: 'Provided',
        text: combinedText,
        raw: combinedText,
      });
      continue;
    }

    // Illustrations heading
    const illHeadingMatch = combinedText.match(/^(Illustrations?)[.—–:]?\s*$/i);
    if (illHeadingMatch) {
      if (currentIllustrationBlock) {
        blocks.push(currentIllustrationBlock);
      }
      currentIllustrationBlock = {
        type: 'illustrations',
        heading: combinedText.trim(),
        items: [],
        raw: combinedText,
      };
      continue;
    }

    // Items under illustrations
    if (currentIllustrationBlock) {
      const itemMatch = combinedText.match(/^(\([a-z0-9]+\)|\d+\.)\s*(.*)$/i);
      if (itemMatch) {
        currentIllustrationBlock.items.push({
          label: itemMatch[1].trim(),
          text: itemMatch[2].trim(),
          raw: combinedText,
        });
        continue;
      } else {
        blocks.push(currentIllustrationBlock);
        currentIllustrationBlock = null;
      }
    }

    // Level 1: Sub-section (1), (2), (2A)...
    const subMatch = combinedText.match(/^(\(\d+[A-Z]?\))\s*(.*)$/);
    if (subMatch) {
      blocks.push({
        type: 'sub',
        label: subMatch[1],
        text: subMatch[2].trim(),
        raw: combinedText,
      });
      continue;
    }

    // Level 3: Sub-clause (i), (ii)...
    const subclauseMatch = combinedText.match(/^(\((i{1,3}|iv|v|vi{0,3}|ix|x)\))\s*(.*)$/i);
    if (subclauseMatch) {
      blocks.push({
        type: 'subclause',
        label: subclauseMatch[1],
        text: subclauseMatch[3].trim(),
        raw: combinedText,
      });
      continue;
    }

    // Level 2: Clause (a), (b)...
    const clauseMatch = combinedText.match(/^(\([a-z]{1,2}\))\s*(.*)$/i);
    if (clauseMatch) {
      blocks.push({
        type: 'clause',
        label: clauseMatch[1],
        text: clauseMatch[2].trim(),
        raw: combinedText,
      });
      continue;
    }

    // Note
    const noteMatch = combinedText.match(/^(Note\s*\d*[.—–-]*\s*)(.*)$/i);
    if (noteMatch) {
      blocks.push({
        type: 'note',
        label: noteMatch[1].trim(),
        text: noteMatch[2].trim(),
        raw: combinedText,
      });
      continue;
    }

    // Default: Para
    blocks.push({
      type: 'para',
      text: combinedText.trim(),
      raw: combinedText,
    });
  }

  if (currentIllustrationBlock) {
    blocks.push(currentIllustrationBlock);
  }

  return blocks;
}

const _loggedFallbackWarnings = new Set<string>();

/**
 * Safe formatter with self-check integrity validation.
 * If selfCheck fails, logs once and safely falls back to a single paragraph.
 */
export function formatSectionSafe(text: string, identifier = 'section'): Block[] {
  if (!text || !text.trim()) return [];

  const blocks = parseSectionText(text);
  const isValid = selfCheck(blocks, text);

  if (!isValid) {
    if (!_loggedFallbackWarnings.has(identifier)) {
      _loggedFallbackWarnings.add(identifier);
      logger.warn(`[formatSection] Self-check failed for ${identifier}. Falling back to plain text.`);
    }
    return [{ type: 'para', text: text.trim(), raw: text.trim() }];
  }

  return blocks;
}
