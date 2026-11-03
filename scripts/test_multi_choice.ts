import { test } from 'node:test';
import assert from 'node:assert/strict';
import { multiChoiceSelected, multiChoiceToggle } from '../src/lib/multiChoice.ts';

const opts = ['भूमि विवाद', 'पारिवारिक विवाद', 'जुआ', 'नशा'];
test('toggle keeps the options order', () => {
  let v = '';
  v = multiChoiceToggle(v, 'नशा', opts);
  v = multiChoiceToggle(v, 'भूमि विवाद', opts);
  assert.equal(v, 'भूमि विवाद, नशा');
  v = multiChoiceToggle(v, 'नशा', opts);
  assert.equal(v, 'भूमि विवाद');
  assert.equal(multiChoiceToggle(v, 'भूमि विवाद', opts), '');
});
test('split', () => {
  assert.deepEqual(multiChoiceSelected('भूमि विवाद, जुआ'), ['भूमि विवाद', 'जुआ']);
  assert.deepEqual(multiChoiceSelected(''), []);
});
