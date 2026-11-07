/**
 * caseDiaryExport.ts — case diary → Word (.docx) in the owner's "पर्चा" layout (src/lib/caseDiaryParcha.ts):
 * one diary, or every diary of a मुकदमा one after another, then the share sheet.
 * `loadParchaParas` is also used by the A4 preview (view-case-diary).
 */
import { Packer, type Document } from 'docx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getCaseDiaryById, getCaseDiariesByFIR, getEntriesByDiary, deserializePlaces } from '@/lib/db/caseDiaryRepo';
import { getFIRById } from '@/lib/db/firRepo';
import { buildParcha, type ParchaPara } from '@/lib/caseDiaryParcha';
import { parchaDocument } from '@/lib/caseDiaryParchaDocx';

/**
 * पर्चा paragraphs for a मुकदमा: all its diaries (oldest first, numbered like the Case Diary tab),
 * or only `onlyDiaryId` (still numbered by its place, "पर्चा नं0 0n … प्रेषित" pointing at the one before).
 */
export async function loadParchaParas(firId: string, onlyDiaryId?: string): Promise<ParchaPara[]> {
  const [diaries, fir] = await Promise.all([getCaseDiariesByFIR(firId), getFIRById(firId)]);
  const ordered = [...diaries].sort((a, b) => a.created_at - b.created_at);
  // मुकदमा सारांश = exactly what the officer typed in the FIR's सारांश box (owner: the app builds nothing).
  const saransh = fir?.mukadma_saransh ?? '';
  const out: ParchaPara[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const d = ordered[i];
    if (onlyDiaryId && d.id !== onlyDiaryId) continue;
    const entries = await getEntriesByDiary(d.id);
    const prev = i > 0 ? { no: i, date: ordered[i - 1].preparation_date } : null;
    out.push(...buildParcha({
      no: i + 1, date: d.preparation_date, start: d.start_time, end: d.end_time,
      places: deserializePlaces(d.places_visited), entries, prev,
    }, saransh));
  }
  return out;
}

/** Packs the document, writes it to the cache folder and opens the share sheet. */
async function saveAndShare(doc: Document, filename: string): Promise<void> {
  // toBase64String works on phones; toBuffer needs Node's Buffer, which
  // React Native doesn't have, so the export failed silently on mobile.
  const base64 = await Packer.toBase64String(doc);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('इस डिवाइस पर शेयरिंग उपलब्ध नहीं है');

  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dialogTitle: `Export — ${filename}`,
    UTI: 'org.openxmlformats.wordprocessingml.document',
  });
}

const safe = (v: string | undefined | null, fallback: string) =>
  (v ?? fallback).replace(/[^a-z0-9]/gi, '_');

// ─── public API ───────────────────────────────────────────────────────────────

/** Exports one case diary (one पर्चा) as a .docx file. */
export async function exportCaseDiaryToDocx(diaryId: string): Promise<void> {
  const diary = await getCaseDiaryById(diaryId);
  if (!diary) throw new Error('Case diary not found');
  const fir = await getFIRById(diary.fir_id);
  const paras = await loadParchaParas(diary.fir_id, diaryId);
  const filename = `Case_Diary_${safe(fir?.fir_number, 'fir')}_${safe(diary.preparation_date, 'diary')}.docx`;
  await saveAndShare(parchaDocument(paras), filename);
}

/** All case diaries of a मुकदमा in one .docx, पर्चा after पर्चा (owner's file). */
export async function exportAllCaseDiariesToDocx(firId: string): Promise<void> {
  const [diaries, fir] = await Promise.all([getCaseDiariesByFIR(firId), getFIRById(firId)]);
  if (diaries.length === 0) throw new Error('इस मुकदमे में कोई केस डायरी नहीं है');
  const paras = await loadParchaParas(firId);
  const filename = `Case_Diary_All_${safe(fir?.fir_number, 'fir')}.docx`;
  await saveAndShare(parchaDocument(paras), filename);
}
