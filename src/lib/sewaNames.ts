/**
 * "सेवा में" — सुझाव (owner): the owner's list of 90 officers / offices (as sent, in order) for the सेवा में boxes — format keys with
 * dropdown_options {"sewa": true}. Matching / own names: courtNames.ts (matchNames, addCustomName), stored per kind in courtNameStore.ts.
 * Kept apart from the न्यायालय list. Pure — tests scripts/test_court_names.ts.
 */
import { addCustomName, matchNames, type CourtHit } from './courtNames';

export const SEWA_NAMES: readonly string[] = [
  'श्रीमान पुलिस अधीक्षक, रायबरेली',
  'श्रीमान अपर पुलिस अधीक्षक',
  'श्रीमान क्षेत्राधिकारी (CO)',
  'श्रीमान प्रभारी निरीक्षक / थानाध्यक्ष',
  'श्रीमान प्रभारी साइबर सेल',
  'श्रीमान प्रभारी सर्विलांस सेल',
  'श्रीमान प्रभारी स्वाट टीम',
  'श्रीमान प्रभारी एसओजी',
  'श्रीमान प्रभारी महिला थाना',
  'श्रीमान प्रभारी एएचटीयू',
  'श्रीमान प्रभारी यातायात',
  'श्रीमान प्रभारी पुलिस लाइन',
  'श्रीमान प्रभारी यूपी-112',
  'श्रीमान जिलाधिकारी',
  'श्रीमान अपर जिलाधिकारी (प्रशासन)',
  'श्रीमान अपर जिलाधिकारी (वित्त एवं राजस्व)',
  'श्रीमान उपजिलाधिकारी (SDM)',
  'श्रीमान तहसीलदार',
  'श्रीमान नायब तहसीलदार',
  'श्रीमान जिला मजिस्ट्रेट',
  'श्रीमान जिला प्रोबेशन अधिकारी',
  'श्रीमान जिला पंचायत राज अधिकारी',
  'श्रीमान खंड विकास अधिकारी (BDO)',
  'श्रीमान ग्राम पंचायत सचिव',
  'श्रीमान लेखपाल',
  'मुख्य चिकित्सा अधिकारी (CMO)',
  'मुख्य चिकित्सा अधीक्षक (CMS)',
  'अधीक्षक, सामुदायिक स्वास्थ्य केंद्र (CHC)',
  'प्रभारी चिकित्साधिकारी, प्राथमिक स्वास्थ्य केंद्र (PHC)',
  'चिकित्सा अधिकारी / इमरजेंसी मेडिकल ऑफिसर',
  'प्रभारी पोस्टमार्टम हाउस',
  'फॉरेंसिक मेडिसिन विशेषज्ञ',
  'मेडिकल बोर्ड',
  'जिला अस्पताल',
  'मानसिक स्वास्थ्य संस्थान',
  'निदेशक, विधि विज्ञान प्रयोगशाला (FSL)',
  'प्रभारी, क्षेत्रीय विधि विज्ञान प्रयोगशाला',
  'प्रभारी, DNA परीक्षण प्रयोगशाला',
  'प्रभारी, साइबर फॉरेंसिक लैब',
  'प्रभारी, फिंगरप्रिंट ब्यूरो',
  'राज्य फॉरेंसिक विज्ञान संस्थान',
  'फॉरेंसिक विशेषज्ञ / वैज्ञानिक अधिकारी',
  'शाखा प्रबंधक, भारतीय स्टेट बैंक',
  'शाखा प्रबंधक, बैंक ऑफ बड़ौदा',
  'शाखा प्रबंधक, पंजाब नेशनल बैंक',
  'शाखा प्रबंधक, यूनियन बैंक',
  'शाखा प्रबंधक, ग्रामीण बैंक',
  'नोडल अधिकारी, बैंक',
  'नोडल अधिकारी, NPCI',
  'नोडल अधिकारी, साइबर क्राइम बैंकिंग',
  'संबंधित UPI / Payment Gateway नोडल अधिकारी',
  'नोडल अधिकारी, Airtel',
  'नोडल अधिकारी, Jio',
  'नोडल अधिकारी, BSNL',
  'नोडल अधिकारी, Vodafone Idea',
  'नोडल अधिकारी, Google',
  'नोडल अधिकारी, Meta / Facebook',
  'नोडल अधिकारी, WhatsApp',
  'नोडल अधिकारी, Instagram',
  'नोडल अधिकारी, Telegram',
  'नोडल अधिकारी, X (Twitter)',
  'जिला बेसिक शिक्षा अधिकारी (BSA)',
  'जिला विद्यालय निरीक्षक (DIOS)',
  'जिला बाल संरक्षण अधिकारी',
  'बाल कल्याण समिति (CWC)',
  'जिला प्रोबेशन अधिकारी',
  'बाल संरक्षण इकाई',
  'प्रधानाचार्य / प्रबंधक, संबंधित विद्यालय',
  'जिला कार्यक्रम अधिकारी (DPO)',
  'आंगनबाड़ी केंद्र',
  'संभागीय परिवहन अधिकारी (RTO)',
  'सहायक संभागीय परिवहन अधिकारी (ARTO)',
  'जिला पूर्ति अधिकारी',
  'जिला आबकारी अधिकारी',
  'खनन अधिकारी',
  'वन अधिकारी (DFO)',
  'विद्युत विभाग के अधिशासी अभियंता',
  'रेलवे सुरक्षा बल (RPF)',
  'राजकीय रेलवे पुलिस (GRP)',
  'अग्निशमन अधिकारी',
  'नगर पालिका / नगर पंचायत',
  'BSNL / विद्युत / जल निगम विभाग',
  'वरिष्ठ जेल अधीक्षक',
  'जेल अधीक्षक',
  'जेलर',
  'अधीक्षक, जिला कारागार',
  'अधीक्षक, बाल सुधार गृह',
  'अधीक्षक, नारी निकेतन',
  'प्रभारी, वन स्टॉप सेंटर',
  'प्रभारी, आश्रय गृह',
];

/** True for a format key marked {"sewa": true}. */
export function isSewaKey(dropdownOptions: string | null | undefined): boolean {
  if (!dropdownOptions || !dropdownOptions.includes('"sewa"')) return false;
  try { return (JSON.parse(dropdownOptions) as { sewa?: unknown }).sewa === true; } catch { return false; }
}

export function matchSewaNames(query: string, custom: readonly string[], limit = 6): CourtHit[] {
  return matchNames(query, custom, SEWA_NAMES, limit);
}

export function addCustomSewa(custom: readonly string[], name: string): string[] {
  return addCustomName(custom, name, SEWA_NAMES);
}

/** The line a multi-line सेवा में box is being typed in: the first line that differs from before (else the last). */
export function changedLineIndex(before: string, after: string): number {
  const a = before.split('\n'), b = after.split('\n');
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return i;
  return Math.max(0, b.length - 1);
}

/** Put a picked name on line `i` of the box, the other lines kept. */
export function replaceLine(value: string, i: number, name: string): string {
  const lines = value.split('\n');
  if (i < 0 || i >= lines.length) return name;
  lines[i] = name;
  return lines.join('\n');
}
