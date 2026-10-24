/** Run: node --experimental-strip-types --test scripts/test_nirodhatmak_extract.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractKaryvahiFacts, extractDispute, extractVillage, extractSections } from '../src/lib/nirodhatmak/extractKaryvahi.ts';

const beat = 'रिपोर्ट चालानी अन्तर्गत धारा 126/135 BNSS थाना बछरावा जनपद रायबरेली। सेवा मे, श्रीमान उपजिलामजिस्ट्रेट महोदय तहसील महराजगंज जनपद रायबरेली। वादी- उ0नि0 जीतेश सिंह थाना बछरावा जनपद रायबरेली । प्रथम पक्ष 1.वीरेंद्र पुत्र सनेही उम्र करीब 25 वर्ष महोदय, निवेदन है कि आज दिनांक 23.10.2026 को मुझ उ0नि0 द्वारा थाना स्थानीय पर दिनांक 20.10.2026 को जीडी न0 12 पर अंकित बीट सूचना की जांच मौके पर जाकर कि गयी तो पाया गया है कि ग्राम सरैया में प्रथम पक्ष के 1.वीरेंद्र पुत्र सनेही व द्वितीय पक्ष 1.रामफेर पुत्र सुखदीन के बीच जमीनी विवाद चल रहा है । जो किसी भी समय आपस में लड झगड कर शान्ति भंग कर सकते हैं । शान्ति एवम कानून व्यवस्था के दृष्टिगत व संगीन संज्ञेय अपराध की रोकथाम हेतु प्रथम पक्ष उपरोक्त के विरुद्ध धारा 126/135 BNSS की कार्यवाही मा0 न्यायालय की जाती है ।';

test('beat 126/135 report', () => {
  const f = extractKaryvahiFacts(beat);
  assert.equal(f.village, 'सरैया');
  assert.equal(f.dispute, 'जमीनी विवाद');
  assert.deepEqual(f.sections, ['धारा 126/135 BNSS']);
});

test('dispute variants', () => {
  assert.equal(extractDispute('ग्राम अ में दोनों पक्षों में रास्ते को लेकर विवाद है। जो किसी भी समय'), 'रास्ते को लेकर विवाद');
  assert.equal(extractDispute('पक्ष 1.राम व 2.श्याम मेड़ के विवाद से रंजिश रखते हैं । जो किसी भी समय'), 'मेड़ के विवाद');
  assert.equal(extractDispute('पक्ष 1.राम व 2.श्याम पुरानी रंजिश को लेकर मनमुटाव रखते हैं । जो किसी भी समय लड़'), 'रंजिश को लेकर मनमुटाव रखते हैं'); // last 6 words of the {{Matter}} clause
  assert.equal(extractDispute(''), '');
});

test('village / sections fallbacks never throw', () => {
  assert.equal(extractVillage('ग्राम पूरे लाला का पुरवा मे विवाद'), 'पूरे लाला का पुरवा');
  assert.equal(extractVillage('कोई ग्राम नहीं'), '');
  assert.deepEqual(extractSections('मु0अ0सं0 12/26 धारा 115(2), 352 BNS की जांचक्रम में … के विरुद्ध धारा 170 BNSS की कार्यवाही की गई'), ['धारा 170 BNSS']);
  assert.deepEqual(extractSections('<p>रिपोर्ट अन्तर्गत धारा 129 BNSS</p>'), ['धारा 129 BNSS']);
  assert.deepEqual(extractKaryvahiFacts(undefined), { village: '', dispute: '', sections: [] });
});
