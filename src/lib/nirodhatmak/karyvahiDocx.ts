/**
 * निरोधात्मक कार्यवाही → Word (.docx) export (same layout as the A4 print).
 * Shows an alert when it fails; the share / save sheet is the success path.
 */
import { Alert } from 'react-native';
import { exportReportToDocx } from '@/lib/reportDocxExport';
import { extractKaryvahiFacts } from './extractKaryvahi';

export async function exportKaryvahiDocx(item: {
  editor_content?: string | null; report_text?: string | null;
  format_title?: string | null; village_name?: string | null; proceeding_date?: string | null;
}): Promise<void> {
  const content = item.editor_content || item.report_text || '';
  if (!content.trim()) { Alert.alert('Export नहीं हो सका', 'इस कार्यवाही में रिपोर्ट नहीं है।'); return; }
  const village = (extractKaryvahiFacts(content).village || item.village_name || '').trim();
  const name = ['निरोधात्मक', village, item.proceeding_date?.slice(0, 10)].filter(Boolean).join('_');
  try {
    await exportReportToDocx(content, name);
  } catch (e) {
    Alert.alert('Export नहीं हो सका', e instanceof Error ? e.message : String(e));
  }
}
