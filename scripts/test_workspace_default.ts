import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { fillWorkspaceDefault } = await import('../src/lib/globalKeyEngine.ts');

const ws = { state: 'उत्तर प्रदेश', district: 'रायबरेली', police_station: 'बछरावां', officer_name: 'जीतेश सिंह' } as never;
test('workspace keys in a default are filled', () => {
  assert.equal(fillWorkspaceDefault('थाना {{PoliceStation}} जनपद {{District}}', ws), 'थाना बछरावां जनपद रायबरेली');
});
test('missing setting → empty box', () => {
  assert.equal(fillWorkspaceDefault('थाना {{PoliceStation}} जनपद {{District}}', { ...(ws as object), district: '' } as never), '');
});
test('plain default unchanged', () => {
  assert.equal(fillWorkspaceDefault('10:00 बजे', ws), '10:00 बजे');
});

test('empty workspace keys get a box and are required (owner)', async () => {
  const g = await import('../src/lib/globalKeyEngine.ts');
  const tpl = 'थाना {{PoliceStation}} जनपद {{District}} {{OfficerName}} {{FIRNo}}';
  const r = g.resolveGlobalKeys(tpl, { police_station: 'बछरावां', district: '', state: '', halka: '', beat: '', officer_name: 'जीतेश सिंह' });
  const all = g.withEmptyWorkspaceKeys(tpl, r.autoValues);
  assert.deepEqual(all, { PoliceStation: 'बछरावां', OfficerName: 'जीतेश सिंह', District: '' });
  assert.deepEqual(g.emptyWorkspaceKeys(all), ['District']);
  assert.deepEqual(g.emptyWorkspaceKeys({ ...all, District: 'रायबरेली', vad_sankhya: '' }), []); // कागज़ values are not required
  assert.equal(g.isWorkspaceKey('OfficerName'), true);
  assert.equal(g.isWorkspaceKey('vad_sankhya'), false);
});
