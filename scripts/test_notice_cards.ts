/** Run: node --experimental-strip-types --test scripts/test_notice_cards.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// noticeCards imports './caseDiaryGap' without an extension (Metro style); let Node find the .ts file.
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { buildNoticeCards, noticeBadgeCount, dueLabel } = await import('../src/lib/noticeCards.ts');

const now = new Date(2026, 9, 25, 10);

test('due labels', () => {
  assert.equal(dueLabel(0), 'आज');
  assert.equal(dueLabel(1), 'कल');
  assert.equal(dueLabel(3), '3 दिन बाकी');
  assert.equal(dueLabel(-2), '2 दिन overdue');
});

test('court + petition: overdue and due in 3 days only', () => {
  const cards = buildNoticeCards({
    courtDocs: [
      { id: 'c1', registration_number: '12/26', doc_type: 'NBW', deadline_date: '2026-10-23' },
      { id: 'c2', registration_number: '13/26', doc_type: 'High_Court_Documents', sub_type: 'Writ', writ_type: 'CRLP', deadline_date: '2026-10-27' },
      { id: 'c3', registration_number: '14/26', doc_type: 'Summons', deadline_date: '2026-11-10' },
    ],
    petitions: [{ id: 'p1', registration_number: '5/26', petition_type: 'RTI', deadline_date: '2026-10-25' }],
  }, now);
  assert.deepEqual(cards.map((c) => c.id), ['court-c1', 'petition-p1', 'court-c2']);
  assert.match(cards[0].body, /NBW तामील की अंतिम तिथि 23\.10\.2026 2 दिन पहले/);
  assert.match(cards[2].title, /हाईकोर्ट दस्तावेज़ \(रिट CRLP\)/);
  assert.equal(cards[1].level, 'over'); // due today counts as urgent
  assert.equal(cards[2].route, '/(app)/nyayalay/c2');
});

test('case diary pending from day 7; reminders due today or missed', () => {
  const cards = buildNoticeCards({
    firs: [
      { id: 'f1', fir_number: '123/26', last_diary_date: '2026-10-08' },
      { id: 'f2', fir_number: '124/26', last_diary_date: '2026-10-22' },
    ],
    reminders: [
      { id: 'r1', title: 'दबिश', due_at: new Date(2026, 9, 25, 8).getTime() },
      { id: 'r2', title: 'मीटिंग', due_at: new Date(2026, 9, 25, 17).getTime() },
      { id: 'r3', title: 'कल', due_at: new Date(2026, 9, 26, 9).getTime() },
    ],
  }, now);
  assert.deepEqual(cards.map((c) => c.id).sort(), ['cd-f1', 'rem-r1', 'rem-r2']);
  const cd = cards.find((c) => c.id === 'cd-f1');
  assert.equal(cd?.level, 'over');
  assert.match(cd?.body ?? '', /15 दिन की सीमा पार/);
  assert.equal(noticeBadgeCount(cards), 2); // r2 later today is info only
});
