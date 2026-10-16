/**
 * playbooks.ts
 * Configuration-driven crime playbooks for the CrimePlaybookEngine.
 * Adding or editing playbooks requires NO engine logic changes.
 *
 * SAFETY: Pure data configuration. No DB access. No writes.
 */

import type { CrimePlaybook, PlaybookStep } from './IntelligenceTypes';

// ── Helpers ──────────────────────────────────────────────────────────────────

let stepId = 0;
const s = (
  title: string,
  description: string,
  isMandatory: boolean,
  category: PlaybookStep['category'],
  opts?: Partial<PlaybookStep>
): PlaybookStep => ({
  id: `step-${++stepId}`,
  title,
  description,
  isMandatory,
  category,
  ...opts,
});

// ── Murder ────────────────────────────────────────────────────────────────────

const MURDER_PLAYBOOK: CrimePlaybook = {
  id: 'pb-murder',
  crimeCategory: 'Murder',
  crimeTypePatterns: ['murder|हत्या|302', 'culpable homicide'],
  sectionPatterns: ['302', '303', '304'],
  description: 'Investigation playbook for murder and culpable homicide cases.',
  steps: [
    s('Register FIR', 'FIR must be registered immediately under BNS Section 103/302.', true, 'documentation', { karyvahiPattern: 'fir|mukadma|प्रथम सूचना', legalReference: 'BNSS Section 173' }),
    s('Crime Scene Inspection', 'Conduct detailed scene of crime inspection with panchnama.', true, 'evidence', { karyvahiPattern: 'scene|ghatnasthal|घटनास्थल|spot' }),
    s('Inquest Report (Section 174)', 'Prepare inquest report for unnatural death.', true, 'documentation', { karyvahiPattern: 'inquest|panch|174|मर्ग', legalReference: 'BNSS Section 194' }),
    s('Post-Mortem Report', 'Obtain post-mortem report from government hospital.', true, 'medical', { karyvahiPattern: 'post.mortem|pm report|शव परीक्षण' }),
    s('Medical Examination of Accused', 'Medically examine accused for injuries/contact traces.', true, 'medical', { karyvahiPattern: 'medical|accused|आरोपी' }),
    s('Arrest of Accused', 'Arrest accused with proper memo and intimation to family.', true, 'investigation', { karyvahiPattern: 'arrest|गिरफ्तार', legalReference: 'BNSS Section 47' }),
    s('Arrest Memo', 'Prepare arrest memo with time, place and witness signatures.', true, 'documentation', { karyvahiPattern: 'arrest memo|गिरफ्तारी पंचनामा' }),
    s('Seizure of Weapon', 'Seize murder weapon with seizure memo/panchnama.', true, 'evidence', { karyvahiPattern: 'seizure|weapon|हथियार|जब्ती' }),
    s('Witness Statements (Section 180 BNSS)', 'Record statements of all eyewitnesses.', true, 'witness', { karyvahiPattern: 'statement|bayan|witness|गवाह|बयान', legalReference: 'BNSS Section 180' }),
    s('FSL/Forensic Referral', 'Send evidence to Forensic Science Lab for examination.', true, 'fsl', { karyvahiPattern: 'fsl|forensic|lab|प्रयोगशाला' }),
    s('Videography (e-Sakshya)', 'Record crime scene and proceedings via e-Sakshya app.', true, 'evidence', { karyvahiPattern: 'video|e-sakshya|ई-साक्ष्य' }),
    s('Case Diary', 'Maintain daily Case Diary recording all investigation steps.', true, 'documentation', { requiresCaseDiary: true, legalReference: 'BNSS Section 193' }),
    s('Court Production', 'Produce accused in court within 24 hours of arrest.', true, 'court', { karyvahiPattern: 'court|nyayalay|production|पेशी', legalReference: 'BNSS Section 56' }),
    s('DNA Sample', 'Collect DNA samples if applicable.', false, 'evidence', { karyvahiPattern: 'dna|dna sample' }),
    s('CCTV Footage', 'Collect and preserve CCTV footage from scene and surroundings.', false, 'evidence', { karyvahiPattern: 'cctv|footage|camera' }),
    s('Call Detail Records', 'Obtain CDR for accused and witnesses.', false, 'investigation', { karyvahiPattern: 'cdr|call record|call detail' }),
  ],
};

// ── Attempt to Murder ─────────────────────────────────────────────────────────

const ATM_PLAYBOOK: CrimePlaybook = {
  id: 'pb-atm',
  crimeCategory: 'Attempt to Murder',
  crimeTypePatterns: ['attempt.*murder|हत्या.*प्रयास|307'],
  sectionPatterns: ['307'],
  description: 'Investigation playbook for attempt to murder cases.',
  steps: [
    s('Register FIR', 'Register FIR under BNS Section 109 immediately.', true, 'documentation', { karyvahiPattern: 'fir|mukadma', legalReference: 'BNSS Section 173' }),
    s('Medical Examination of Victim', 'Obtain MLC/injury report from government hospital.', true, 'medical', { karyvahiPattern: 'medical|mlc|victim|पीड़ित' }),
    s('Crime Scene Inspection', 'Inspect and photograph crime scene.', true, 'evidence', { karyvahiPattern: 'scene|ghatnasthal|spot' }),
    s('Seizure of Weapon', 'Seize weapon used with panchnama.', true, 'evidence', { karyvahiPattern: 'seizure|weapon|हथियार' }),
    s('Witness Statements', 'Record statements of all eyewitnesses.', true, 'witness', { karyvahiPattern: 'statement|bayan|witness' }),
    s('Arrest of Accused', 'Arrest accused with proper memo.', true, 'investigation', { karyvahiPattern: 'arrest|गिरफ्तार' }),
    s('Arrest Memo', 'Prepare arrest memo.', true, 'documentation', { karyvahiPattern: 'arrest memo' }),
    s('FSL Referral', 'Send weapon and evidence to FSL.', true, 'fsl', { karyvahiPattern: 'fsl|forensic' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Court Production', 'Produce accused in court within 24 hours.', true, 'court', { karyvahiPattern: 'court|production' }),
    s('CCTV Footage', 'Collect CCTV footage if available.', false, 'evidence', { karyvahiPattern: 'cctv|footage' }),
    s('Statement of Victim', 'Record victim statement under Section 183 BNSS.', false, 'witness', { karyvahiPattern: 'victim.*statement|statement.*victim|पीड़ित.*बयान' }),
  ],
};

// ── Theft ─────────────────────────────────────────────────────────────────────

const THEFT_PLAYBOOK: CrimePlaybook = {
  id: 'pb-theft',
  crimeCategory: 'Theft',
  crimeTypePatterns: ['theft|चोरी|303|304|305|380|381'],
  sectionPatterns: ['303', '304', '305', '380', '381', '382'],
  description: 'Investigation playbook for theft cases.',
  steps: [
    s('Register FIR', 'Register FIR under appropriate BNS section.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Crime Scene Inspection', 'Inspect and document the scene of theft.', true, 'evidence', { karyvahiPattern: 'scene|ghatnasthal' }),
    s('Witness Statements', 'Record witness and complainant statements.', true, 'witness', { karyvahiPattern: 'statement|bayan|witness' }),
    s('Property List / Recovery', 'Prepare list of stolen property and attempt recovery.', true, 'evidence', { karyvahiPattern: 'recovery|property|माल.*बरामद|recovery memo' }),
    s('Seizure Memo on Recovery', 'Prepare seizure memo for recovered property.', true, 'evidence', { karyvahiPattern: 'seizure|जब्ती' }),
    s('Arrest of Accused (if known)', 'Arrest accused with proper documentation.', false, 'investigation', { karyvahiPattern: 'arrest' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('CCTV Footage', 'Collect CCTV footage from scene.', false, 'evidence', { karyvahiPattern: 'cctv' }),
  ],
};

// ── Robbery ───────────────────────────────────────────────────────────────────

const ROBBERY_PLAYBOOK: CrimePlaybook = {
  id: 'pb-robbery',
  crimeCategory: 'Robbery',
  crimeTypePatterns: ['robbery|डकैती|loot|392|393|394'],
  sectionPatterns: ['392', '393', '394', '395'],
  description: 'Investigation playbook for robbery cases.',
  steps: [
    s('Register FIR', 'Register FIR immediately.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Medical Examination of Victim', 'Get MLC if victim sustained injuries.', true, 'medical', { karyvahiPattern: 'medical|mlc|victim' }),
    s('Crime Scene Inspection', 'Document scene, collect clues.', true, 'evidence', { karyvahiPattern: 'scene|ghatnasthal' }),
    s('Seizure of Weapon', 'Seize any weapon used in robbery.', true, 'evidence', { karyvahiPattern: 'seizure|weapon|हथियार' }),
    s('Witness Statements', 'Record all eyewitness and victim statements.', true, 'witness', { karyvahiPattern: 'statement|bayan|witness' }),
    s('Arrest of Accused', 'Arrest accused with arrest memo.', true, 'investigation', { karyvahiPattern: 'arrest' }),
    s('Recovery of Stolen Property', 'Recover stolen articles with seizure memo.', true, 'evidence', { karyvahiPattern: 'recovery|property' }),
    s('FSL Referral', 'Send weapon and exhibits to FSL.', false, 'fsl', { karyvahiPattern: 'fsl|forensic' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Court Production', 'Produce accused in court within 24 hours.', true, 'court', { karyvahiPattern: 'court|production' }),
  ],
};

// ── POCSO ─────────────────────────────────────────────────────────────────────

const POCSO_PLAYBOOK: CrimePlaybook = {
  id: 'pb-pocso',
  crimeCategory: 'POCSO',
  crimeTypePatterns: ['pocso|child.*sexual|sexual.*child|बाल.*यौन'],
  sectionPatterns: ['4', '6', '8', '10', '12'],
  description: 'Investigation playbook for POCSO cases. Sensitive case — follow special procedure.',
  steps: [
    s('Register FIR', 'Register FIR under POCSO Act immediately.', true, 'documentation', { karyvahiPattern: 'fir|mukadma', legalReference: 'POCSO Section 19' }),
    s('Medical Examination of Child Victim', 'Medical examination by female doctor in child-friendly environment.', true, 'medical', { karyvahiPattern: 'medical|victim|child|बच्च' }),
    s('Statement Under Section 164 CrPC/BNSS', 'Record statement of child before Magistrate.', true, 'witness', { karyvahiPattern: '164|magistrate|statement', legalReference: 'BNSS Section 183' }),
    s('Child Welfare Committee Information', 'Inform Child Welfare Committee within 24 hours.', true, 'documentation', { karyvahiPattern: 'cwc|child welfare', legalReference: 'POCSO Section 19' }),
    s('Arrest of Accused', 'Arrest accused with proper documentation.', true, 'investigation', { karyvahiPattern: 'arrest' }),
    s('Arrest Memo', 'Prepare arrest memo.', true, 'documentation', { karyvahiPattern: 'arrest memo' }),
    s('Witness Statements', 'Record parent/guardian/witness statements.', true, 'witness', { karyvahiPattern: 'statement|bayan|witness|parent' }),
    s('FSL / DNA Evidence', 'Collect and send biological evidence to FSL.', true, 'fsl', { karyvahiPattern: 'fsl|dna|forensic' }),
    s('Videography', 'Record proceedings via e-Sakshya.', true, 'evidence', { karyvahiPattern: 'video|e-sakshya' }),
    s('Case Diary', 'Maintain daily case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Court Production within 24 hours', 'Produce accused in Special POCSO Court.', true, 'court', { karyvahiPattern: 'court|production', legalReference: 'POCSO Section 33' }),
    s('CCTV Footage', 'Collect CCTV from crime location.', false, 'evidence', { karyvahiPattern: 'cctv' }),
  ],
};

// ── Missing Person ─────────────────────────────────────────────────────────────

const MISSING_PLAYBOOK: CrimePlaybook = {
  id: 'pb-missing',
  crimeCategory: 'Missing Person',
  crimeTypePatterns: ['missing|गुमशुदा|kidnapping|अपहरण|365'],
  description: 'Investigation playbook for missing person cases.',
  steps: [
    s('Register Missing Report / FIR', 'Register missing person report immediately.', true, 'documentation', { karyvahiPattern: 'fir|missing|गुमशुदा' }),
    s('Complainant Statement', 'Record detailed statement from complainant.', true, 'witness', { karyvahiPattern: 'statement|bayan|complainant' }),
    s('Photograph Collection', 'Collect recent photograph of missing person.', true, 'documentation', { karyvahiPattern: 'photo|photograph|तस्वीर' }),
    s('Area Search', 'Conduct systematic area search.', true, 'investigation', { karyvahiPattern: 'search|area|तलाशी' }),
    s('Witness Enquiry', 'Enquire with neighbours, relatives and last seen witnesses.', true, 'witness', { karyvahiPattern: 'enquiry|witness|neighbour' }),
    s('CCTV Footage', 'Collect CCTV footage from last seen location.', true, 'evidence', { karyvahiPattern: 'cctv' }),
    s('Phone/CDR Analysis', 'Analyse call records of missing person.', false, 'investigation', { karyvahiPattern: 'cdr|phone|call' }),
    s('Social Media Check', 'Check social media accounts of missing person.', false, 'investigation', { karyvahiPattern: 'social media|facebook|whatsapp' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
  ],
};

// ── Domestic Violence ─────────────────────────────────────────────────────────

const DV_PLAYBOOK: CrimePlaybook = {
  id: 'pb-dv',
  crimeCategory: 'Domestic Violence',
  crimeTypePatterns: ['domestic.*violence|498a|498-a|दहेज|dowry|cruelty'],
  sectionPatterns: ['498', '85', '86'],
  description: 'Investigation playbook for domestic violence and dowry harassment cases.',
  steps: [
    s('Register FIR', 'Register FIR under BNS Section 85/86 or PWDVA.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Medical Examination of Victim', 'Medical examination with MLC for injuries.', true, 'medical', { karyvahiPattern: 'medical|mlc|victim' }),
    s('Victim Statement (Section 164)', 'Record statement before magistrate.', true, 'witness', { karyvahiPattern: '164|magistrate|victim.*statement' }),
    s('Witness Statements', 'Record statements of neighbours and relatives.', true, 'witness', { karyvahiPattern: 'statement|bayan|witness' }),
    s('Seizure of Dowry Articles', 'Seize dowry articles as evidence.', false, 'evidence', { karyvahiPattern: 'seizure|dowry|दहेज' }),
    s('Arrest if Required', 'Arrest accused with proper documentation.', false, 'investigation', { karyvahiPattern: 'arrest' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Information to Protection Officer', 'Inform Protection Officer under PWDVA.', false, 'documentation', { karyvahiPattern: 'protection officer|pwdva' }),
  ],
};

// ── NDPS ──────────────────────────────────────────────────────────────────────

const NDPS_PLAYBOOK: CrimePlaybook = {
  id: 'pb-ndps',
  crimeCategory: 'NDPS',
  crimeTypePatterns: ['ndps|narcotics|drug|नशा|narcotic drug'],
  description: 'Investigation playbook for NDPS Act cases.',
  steps: [
    s('Register FIR', 'Register FIR under NDPS Act.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Seizure Memo with Two Independent Witnesses', 'Prepare seizure memo in presence of gazetted officer and two independent witnesses.', true, 'evidence', { karyvahiPattern: 'seizure|जब्ती', legalReference: 'NDPS Section 50' }),
    s('Weighment Certificate', 'Obtain official weighment certificate for seized narcotics.', true, 'evidence', { karyvahiPattern: 'weigh|weight|तौल' }),
    s('Sample Preservation and FSL', 'Send representative sample to FSL for chemical analysis.', true, 'fsl', { karyvahiPattern: 'fsl|sample|chemical|forensic' }),
    s('Arrest of Accused', 'Arrest accused with proper documentation.', true, 'investigation', { karyvahiPattern: 'arrest' }),
    s('Arrest Memo', 'Prepare arrest memo.', true, 'documentation', { karyvahiPattern: 'arrest memo' }),
    s('Witness Statements', 'Record statements of seizure witnesses and informant.', true, 'witness', { karyvahiPattern: 'statement|witness|informer' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Court Production within 24 hours', 'Produce before Special NDPS Court.', true, 'court', { karyvahiPattern: 'court|production' }),
    s('Source Disclosure Statement', 'Record accused statement regarding source of narcotics.', false, 'witness', { karyvahiPattern: 'source|disclosure|statement.*accused' }),
  ],
};

// ── Cyber Crime ───────────────────────────────────────────────────────────────

const CYBER_PLAYBOOK: CrimePlaybook = {
  id: 'pb-cyber',
  crimeCategory: 'Cyber Crime',
  crimeTypePatterns: ['cyber|online fraud|hacking|phishing|साइबर'],
  description: 'Investigation playbook for cyber crime cases.',
  steps: [
    s('Register FIR', 'Register FIR under BNS IT Act sections.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Preserve Digital Evidence', 'Preserve and document digital evidence (screenshots, emails, chat logs).', true, 'evidence', { karyvahiPattern: 'digital|screenshot|email|chat|evidence' }),
    s('Complainant Statement', 'Record detailed victim/complainant statement.', true, 'witness', { karyvahiPattern: 'statement|bayan|victim|complainant' }),
    s('Bank/Payment Records', 'Obtain bank transaction records and payment gateway logs.', true, 'evidence', { karyvahiPattern: 'bank|payment|transaction' }),
    s('IP Address Tracking', 'Obtain IP address and location data from service providers.', true, 'investigation', { karyvahiPattern: 'ip|address|isp|server' }),
    s('Phone Number / SIM Analysis', 'Analyse phone numbers used in crime.', true, 'investigation', { karyvahiPattern: 'phone|sim|mobile|number' }),
    s('Social Media Records', 'Obtain records from social media platforms.', false, 'evidence', { karyvahiPattern: 'social media|facebook|twitter|instagram' }),
    s('Technical Expert Examination', 'Examine digital devices with cyber expert.', false, 'fsl', { karyvahiPattern: 'expert|technical|device|examination' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Arrest if Identified', 'Arrest accused once identified.', false, 'investigation', { karyvahiPattern: 'arrest' }),
  ],
};

// ── Road Accident ─────────────────────────────────────────────────────────────

const ROAD_ACCIDENT_PLAYBOOK: CrimePlaybook = {
  id: 'pb-accident',
  crimeCategory: 'Road Accident',
  crimeTypePatterns: ['accident|road accident|vehicle|motor|279|304a|338'],
  description: 'Investigation playbook for road accident / MVC cases.',
  steps: [
    s('Register FIR', 'Register FIR under BNS Section 281/106 Motor Vehicles Act.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Scene of Accident Inspection', 'Inspect scene with measurement sketch and photography.', true, 'evidence', { karyvahiPattern: 'scene|accident.*spot|spot.*accident|measurement|sketch' }),
    s('Medical Examination of Victim', 'Obtain MLC / post-mortem for injured/deceased.', true, 'medical', { karyvahiPattern: 'medical|mlc|post.mortem|victim' }),
    s('Seizure of Vehicle', 'Seize offending vehicle with panchnama.', true, 'evidence', { karyvahiPattern: 'vehicle|seizure|गाड़ी' }),
    s('Driver/Accused Statement', 'Record statement of driver and accused.', true, 'witness', { karyvahiPattern: 'driver|statement|accused' }),
    s('Witness Statements', 'Record eyewitness statements.', true, 'witness', { karyvahiPattern: 'witness|bayan|statement' }),
    s('CCTV/Dashcam Footage', 'Collect CCTV and dashcam footage.', false, 'evidence', { karyvahiPattern: 'cctv|dashcam|footage' }),
    s('FSL Examination of Vehicle', 'Send vehicle for FSL/mechanical examination if required.', false, 'fsl', { karyvahiPattern: 'fsl|mechanical|vehicle.*exam' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
  ],
};

// ── Arms Act ──────────────────────────────────────────────────────────────────

const ARMS_PLAYBOOK: CrimePlaybook = {
  id: 'pb-arms',
  crimeCategory: 'Arms Act',
  crimeTypePatterns: ['arms act|illegal weapon|अवैध हथियार|25.*arms|27.*arms'],
  description: 'Investigation playbook for Arms Act cases.',
  steps: [
    s('Register FIR', 'Register FIR under Arms Act.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Seizure of Arms with Panchnama', 'Seize weapon with proper panchnama in presence of witnesses.', true, 'evidence', { karyvahiPattern: 'seizure|weapon|arms|पंचनामा' }),
    s('Arrest of Accused', 'Arrest accused with arrest memo.', true, 'investigation', { karyvahiPattern: 'arrest' }),
    s('FSL Ballistics Report', 'Send weapon to FSL for ballistics examination.', true, 'fsl', { karyvahiPattern: 'fsl|ballistics|forensic' }),
    s('Ammunition Seizure', 'Seize and document ammunition found with weapon.', false, 'evidence', { karyvahiPattern: 'ammunition|cartridge|bullet' }),
    s('License Verification', 'Verify if accused holds valid arms license.', true, 'documentation', { karyvahiPattern: 'license|licence|permit' }),
    s('Witness Statements', 'Record seizure witness statements.', true, 'witness', { karyvahiPattern: 'witness|statement|bayan' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Court Production within 24 hours', 'Produce accused in court.', true, 'court', { karyvahiPattern: 'court|production' }),
  ],
};

// ── Kidnapping ────────────────────────────────────────────────────────────────

const KIDNAPPING_PLAYBOOK: CrimePlaybook = {
  id: 'pb-kidnapping',
  crimeCategory: 'Kidnapping',
  crimeTypePatterns: ['kidnap|अपहरण|365|366|367|368'],
  description: 'Investigation playbook for kidnapping cases.',
  steps: [
    s('Register FIR Immediately', 'Register FIR immediately — treat as urgent case.', true, 'documentation', { karyvahiPattern: 'fir|mukadma', legalReference: 'BNSS Section 173' }),
    s('Complainant Statement', 'Record detailed statement of complainant.', true, 'witness', { karyvahiPattern: 'statement|complainant|bayan' }),
    s('Photograph of Missing/Kidnapped Person', 'Collect recent photograph.', true, 'documentation', { karyvahiPattern: 'photo' }),
    s('Area Search / Tracking', 'Conduct systematic search and tracking operations.', true, 'investigation', { karyvahiPattern: 'search|tracking|area' }),
    s('CDR / Phone Analysis', 'Analyse phone records of victim and suspects.', true, 'investigation', { karyvahiPattern: 'cdr|phone|mobile' }),
    s('Witness Statements', 'Record all witness statements.', true, 'witness', { karyvahiPattern: 'witness|statement' }),
    s('CCTV Footage', 'Collect CCTV from kidnapping location.', true, 'evidence', { karyvahiPattern: 'cctv' }),
    s('Arrest of Accused', 'Arrest accused upon identification.', true, 'investigation', { karyvahiPattern: 'arrest' }),
    s('Medical Examination of Victim on Recovery', 'Medical examination after victim recovery.', false, 'medical', { karyvahiPattern: 'medical|victim|recovery' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
  ],
};

// ── Economic Offences ─────────────────────────────────────────────────────────

const ECONOMIC_PLAYBOOK: CrimePlaybook = {
  id: 'pb-economic',
  crimeCategory: 'Economic Offences',
  crimeTypePatterns: ['fraud|cheating|forgery|embezzlement|420|468|471|economic|आर्थिक'],
  description: 'Investigation playbook for economic offences and fraud cases.',
  steps: [
    s('Register FIR', 'Register FIR under appropriate BNS/special act sections.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Complainant Detailed Statement', 'Record detailed victim/complainant statement with documentary evidence.', true, 'witness', { karyvahiPattern: 'statement|bayan|complainant|victim' }),
    s('Document Seizure', 'Seize relevant documents — agreements, receipts, bank statements.', true, 'evidence', { karyvahiPattern: 'seizure|document|paper|record' }),
    s('Bank Record Verification', 'Obtain and verify bank records and transaction history.', true, 'evidence', { karyvahiPattern: 'bank|account|transaction' }),
    s('Witness Statements', 'Record statements of bank officials, co-workers, witnesses.', true, 'witness', { karyvahiPattern: 'witness|statement|official' }),
    s('Expert/CA/Technical Opinion', 'Obtain expert opinion for financial/accounting matters.', false, 'fsl', { karyvahiPattern: 'expert|ca|accountant|technical' }),
    s('Arrest of Accused', 'Arrest accused with proper documentation.', false, 'investigation', { karyvahiPattern: 'arrest' }),
    s('Asset Attachment', 'Identify and attach proceeds of crime if applicable.', false, 'evidence', { karyvahiPattern: 'attachment|asset|property|संपत्ति' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
  ],
};

// ── Property Disputes ─────────────────────────────────────────────────────────

const PROPERTY_PLAYBOOK: CrimePlaybook = {
  id: 'pb-property',
  crimeCategory: 'Property Disputes',
  crimeTypePatterns: ['property.*dispute|encroachment|trespass|land.*dispute|संपत्ति|जमीन'],
  description: 'Investigation playbook for property dispute cases.',
  steps: [
    s('Register FIR / NCR', 'Register FIR or NCR as applicable.', true, 'documentation', { karyvahiPattern: 'fir|mukadma|ncr' }),
    s('Complainant Statement', 'Record complainant statement with property details.', true, 'witness', { karyvahiPattern: 'statement|complainant' }),
    s('Site Inspection / Measurement', 'Conduct physical inspection and measurement of disputed property.', true, 'evidence', { karyvahiPattern: 'site|inspection|measurement|patwari|revenue' }),
    s('Revenue Records Verification', 'Verify ownership records from revenue department.', true, 'evidence', { karyvahiPattern: 'revenue|record|patwari|khasra|khatauni' }),
    s('Witness Statements', 'Record statements of neighbours and witnesses.', true, 'witness', { karyvahiPattern: 'witness|statement' }),
    s('Mediatory Proceedings if Applicable', 'Attempt mediation under Section 23 BNS if applicable.', false, 'documentation', { karyvahiPattern: 'mediation|samjhauta' }),
    s('Case Diary', 'Maintain case diary.', true, 'documentation', { requiresCaseDiary: true }),
  ],
};

// ── Dacoity ───────────────────────────────────────────────────────────────────

const DACOITY_PLAYBOOK: CrimePlaybook = {
  id: 'pb-dacoity',
  crimeCategory: 'Dacoity',
  crimeTypePatterns: ['dacoity|dacoit|396|395|डकैती'],
  description: 'Investigation playbook for dacoity cases.',
  steps: [
    s('Register FIR Immediately', 'Register FIR immediately — high-priority case.', true, 'documentation', { karyvahiPattern: 'fir|mukadma' }),
    s('Medical Examination of Victims', 'Obtain MLC for injured victims.', true, 'medical', { karyvahiPattern: 'medical|mlc|victim' }),
    s('Crime Scene Inspection', 'Detailed scene inspection with collection of physical evidence.', true, 'evidence', { karyvahiPattern: 'scene|ghatnasthal' }),
    s('Witness Statements', 'Record all victim and eyewitness statements.', true, 'witness', { karyvahiPattern: 'statement|witness|victim' }),
    s('Seizure of Weapons / Loot', 'Seize weapons and recovered loot with panchnama.', true, 'evidence', { karyvahiPattern: 'seizure|weapon|loot|recovery' }),
    s('Arrest of Accused', 'Identify and arrest accused with proper memo.', true, 'investigation', { karyvahiPattern: 'arrest' }),
    s('FSL Referral', 'Send physical evidence to FSL.', false, 'fsl', { karyvahiPattern: 'fsl|forensic' }),
    s('CCTV Footage', 'Collect CCTV footage from scene and route.', false, 'evidence', { karyvahiPattern: 'cctv' }),
    s('Case Diary', 'Maintain daily case diary.', true, 'documentation', { requiresCaseDiary: true }),
    s('Court Production', 'Produce accused in court within 24 hours.', true, 'court', { karyvahiPattern: 'court|production' }),
  ],
};

// ── All playbooks registry ────────────────────────────────────────────────────

export const ALL_PLAYBOOKS: CrimePlaybook[] = [
  MURDER_PLAYBOOK,
  ATM_PLAYBOOK,
  THEFT_PLAYBOOK,
  ROBBERY_PLAYBOOK,
  DACOITY_PLAYBOOK,
  CYBER_PLAYBOOK,
  NDPS_PLAYBOOK,
  ARMS_PLAYBOOK,
  ROAD_ACCIDENT_PLAYBOOK,
  MISSING_PLAYBOOK,
  KIDNAPPING_PLAYBOOK,
  POCSO_PLAYBOOK,
  DV_PLAYBOOK,
  ECONOMIC_PLAYBOOK,
  PROPERTY_PLAYBOOK,
];

/**
 * Find the best-matching playbook for a given crime type + sections.
 * Returns null if no match found (caller should use generic fallback).
 */
export function findPlaybook(crimeType: string, sections: string): CrimePlaybook | null {
  const combined = `${crimeType} ${sections}`.toLowerCase();
  for (const pb of ALL_PLAYBOOKS) {
    for (const pat of pb.crimeTypePatterns) {
      if (new RegExp(pat, 'i').test(combined)) return pb;
    }
    if (pb.sectionPatterns) {
      for (const sp of pb.sectionPatterns) {
        if (combined.includes(sp)) return pb;
      }
    }
  }
  return null;
}
