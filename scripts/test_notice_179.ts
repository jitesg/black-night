import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');
const d = JSON.parse(readFileSync(new URL('../assets/seed/formats_seed.json', import.meta.url), 'utf8'));
const f = d.formats.find((x: { id: string }) => x.id === 'sys-fmt-notice-179-bnss');
const P = (name: string, rel: string, father: string, addr: string) => JSON.stringify([{ name, relationType: rel, fatherOrHusbandName: father, fullAddress: addr }]);
const base = { PoliceStation: 'बछरावां', District: 'रायबरेली', FIRNo: '297/2025', Sections: '352 बीएनएस', pad: 'उपनिरीक्षक', OfficerName: 'जीतेश सिंह',
  VadiCard: P('रेनू', 'पत्नी', 'धीरज', 'ग्राम अघौरा'), NoticeCard: P('रामचन्द्र', 'पुत्र', 'भिखारी', 'ग्राम भग्तिन खेड़ा'),
  AppearDate: '2025-07-08', AppearTime: '10:00 बजे', AmPm: 'पूर्वान्ह', AppearAt: 'थाना बछरावां जनपद रायबरेली' };

test('179 notice: cards, dates dd/mm/yyyy, officer with rank', () => {
  const r: string = generateReport(f.vivran, { ...base, NoticeDate: '2025-07-05', FirDate: '01.07.2025' }, f.keys);
  assert.match(r, /नाम – रामचन्द्र पुत्र भिखारी/);
  assert.match(r, /पता – ग्राम भग्तिन खेड़ा/);
  assert.match(r, /मामला रेनू पत्नी धीरज निवासी ग्राम अघौरा की शिकायत/);
  assert.match(r, /दिनांक 08\/07\/2025 को समय 10:00 बजे पूर्वान्ह थाना बछरावां जनपद रायबरेली पर उपस्थित होना है/);
  assert.match(r, /दिनांक – 01\/07\/2025/);
  assert.match(r, /दिनांक – 05\/07\/2025/);
  assert.match(r, /विवेचक का नाम – उ0नि0 जीतेश सिंह/);
  assert.match(r, /धारा 208/);
});
test('179 notice: empty optional boxes print dots', () => {
  const r: string = generateReport(f.vivran, base, f.keys);
  assert.match(r, /रो0आम संख्या \/ समय – \.{10}/);
  assert.match(r, /\(यदि कोई हो\) – \.{10}/);
  assert.match(r, /दिनांक – \.{10}/);
  assert.doesNotMatch(r, /\{\{/);
});
