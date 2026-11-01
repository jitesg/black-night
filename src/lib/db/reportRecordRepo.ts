/**
 * reportRecordRepo — "हाल के कार्य": every report made from a predefined format (Formats, GD, निरोधात्मक,
 * न्यायालय, प्रार्थना पत्र, केस डायरी) is saved here with its layout marks, kept forever (owner), opened
 * again in formats/preview (A4, Word, edit). Rules in src/lib/reportRecordCore.ts.
 */
import { dbGetAllAsync, dbGetFirstAsync, dbRunAsync, generateUUID, nowTimestamp } from './database';
import { REPLACE_WINDOW_S, rangeStart, reportSummary, type RecordRange, type ReportRecord } from '../reportRecordCore';
import { stripFormatMarkers } from '../formatMarkers';
import { htmlToPlainText } from '../stringUtils';

export async function saveReportRecord(input: {
  formatId?: string | null;
  formatTitle: string;
  module?: string | null;
  markedText: string;
  values?: Record<string, string>;
}): Promise<string | null> {
  try {
    // User-made formats are stored as editor HTML → plain text (marks are kept).
    const raw = String(input.markedText ?? '');
    const marked = (/<[a-z][\s\S]*?>/i.test(raw) ? htmlToPlainText(raw) : raw).trim();
    if (!marked) return null;
    const now = nowTimestamp();
    const summary = reportSummary(input.values ?? {}, stripFormatMarkers(marked));
    // Generated again soon after (a correction) → replace that record instead of adding one more.
    if (input.formatId) {
      const recent = await dbGetFirstAsync<{ id: string }>(
        `SELECT id FROM report_records WHERE deleted_at IS NULL AND format_id = ? AND created_at >= ?
         ORDER BY created_at DESC LIMIT 1`,
        [input.formatId, now - REPLACE_WINDOW_S],
      );
      if (recent?.id) {
        await dbRunAsync(
          `UPDATE report_records SET marked_text = ?, edited_html = NULL, summary = ?, module = ?, updated_at = ? WHERE id = ?`,
          [marked, summary, input.module ?? null, now, recent.id],
        );
        return recent.id;
      }
    }
    const id = generateUUID();
    await dbRunAsync(
      `INSERT INTO report_records (id, format_id, format_title, module, summary, marked_text, edited_html, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [id, input.formatId ?? null, input.formatTitle || 'रिपोर्ट', input.module ?? null, summary, marked, now, now],
    );
    return id;
  } catch (e) {
    if (__DEV__) console.warn('[reportRecords] save failed', e);
    return null;
  }
}

export async function updateReportRecordEdit(id: string, editedHtml: string): Promise<void> {
  try {
    await dbRunAsync(`UPDATE report_records SET edited_html = ?, updated_at = ? WHERE id = ?`, [editedHtml, nowTimestamp(), id]);
  } catch (e) {
    if (__DEV__) console.warn('[reportRecords] update failed', e);
  }
}

export async function listReportRecords(range: RecordRange): Promise<ReportRecord[]> {
  return dbGetAllAsync<ReportRecord>(
    `SELECT * FROM report_records WHERE deleted_at IS NULL AND created_at >= ? ORDER BY created_at DESC`,
    [rangeStart(range)],
  );
}

export async function getReportRecord(id: string): Promise<ReportRecord | null> {
  return dbGetFirstAsync<ReportRecord>(`SELECT * FROM report_records WHERE id = ? AND deleted_at IS NULL`, [id]);
}

export async function deleteReportRecord(id: string): Promise<void> {
  await dbRunAsync(`UPDATE report_records SET deleted_at = ?, updated_at = ? WHERE id = ?`, [nowTimestamp(), nowTimestamp(), id]);
}

/** Home tile: reports made today and in the last 7 days. */
export async function reportRecordCounts(): Promise<{ today: number; week: number }> {
  try {
    const row = await dbGetFirstAsync<{ today: number; week: number }>(
      `SELECT SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today, COUNT(*) AS week
       FROM report_records WHERE deleted_at IS NULL AND created_at >= ?`,
      [rangeStart('today'), rangeStart('week')],
    );
    return { today: Number(row?.today ?? 0), week: Number(row?.week ?? 0) };
  } catch {
    return { today: 0, week: 0 };
  }
}
