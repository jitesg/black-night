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
