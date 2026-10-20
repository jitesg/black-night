# POCSO Hindi teaching layer: legal audit (out.json -> out_v.json)

Audit date: 2026-10-20. Scope: all 47 entries. Output: `pocso/out_v.json` (valid JSON, 47 entries, same order and `no`, English untouched).

**Counts:** 45 of 47 entries changed (40 with substantive text/law/case changes; 5 changed only by removal of weak sop/circ links). Unchanged: 40, 46.

## 1. Change table (per section)

| Sec | What was wrong / changed | Source / evidence |
|---|---|---|
| 1 | hi said J&K 'अलग रखा गया' with only a vague 'verify'; 14-11-2012 stated as 'माना जाता है'; no mention that the 2019 enhanced punishments apply only prospectively; example wrongly said old (2012) incident gets 'IPC (अब BNS)' | bnblegal consolidated POCSO Act https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-act-2012/ (s.1(2) footnote Act 34 of 2019; s.1(3) footnote S.O. 2705(E) 14-11-2012; Act 25/2019 effective 16-08-2019); Art. 20(1) Constitution |
| 2 | Hindi mis-stated 'Domestic relationship' as a household definition; s.2(2) list (CrPC, JJ Act, IT Act) dropped; 2019 new clause 2(1)(da) 'child pornography' missing; claimed 'POCSO Rules 2020' govern age determination (no such rule found; Rules 2020 have no age rule); JJ s.94 order was jumbled in the example (it listed 'admission register' with birth certificate and CWC for ossification); BNS/IPC applicability by date of offence not stated; weak SOP/circ links removed (b2-19, b1-05, dg-70-2013 which is about ss.363/366 HC orders) | advocatekhoj s.2(2) https://www.advocatekhoj.com/library/bareacts/childrenprotection/2.php ; bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ ; JJ s.94(2) order per P. Yuvaprakash summary https://www.scconline.com/blog/?p=297286 ; lawtimesjournal Rules list https://lawtimesjournal.in/amendment-to-pocso-rule-2020-while-replacing-earlier-2012-rules/ |
| 2 | Added case P. Yuvaprakash (2023 SCC OnLine SC 846) and refined Independent Thought holding | https://www.scconline.com/blog/?p=297286 |
| 3 | (c) of s.3 mistranslated ('छेड़छाड़ कर ऐसा भेदन कराए' - dropped 'any part of body of the child'); 'थोड़ा सा भी' attributed to all four limbs though only (a),(b) say 'to any extent'; update said 'IPC 375/376 = BNS 63-64' (IPC 376 maps to BNS 64-71); 'consent irrelevant' stated as if in the text | in.json s.3 vs out.json; law_map.json rev IPC 375/376 |
| 4 | Mostly correct vs known facts; added the prospective-only (16-08-2019) caveat, removed vague 'India Code से मिलान' lines now verified, made example date-aware, corrected law note on BNS 65(1)/(2) | bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ ; law_map BNS 65 <- IPC 376(3), 376AB |
| 5 | Dropped details in Hindi: (j)(i) 'impairment so as to be unable to perform regular tasks', (a)/(b) the four limbs (places), (g) explanation attached to wrong clause, (n) 'foster care'; clauses only in Hindi letters though FIRs cite English letters (added both); 2019 update text made precise ('natural calamity or similar situations'); example 2 'DNA of the pregnancy' vague; example 1 said SHO got investigation transferred (SHO cannot); removed weakly linked circ dg-16-2013 | in.json s.5; bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ (s.5 clause (j)(iv), (s)); bnblegal consolidated POCSO Act https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-act-2012/ |
| 6 | Added the 'natural life' meaning, victim-fine purpose, and prospective-only caveat; dropped unverifiable 'India Code से मिलान' line (text verified); weak SOP link b1-06 removed | bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ ; bnblegal consolidated POCSO Act https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-act-2012/ (s.6(1)) |
| 7 | Example described a school teacher assaulting a pupil -> that is aggravated sexual assault s.9(f)/(p), inconsistent with a s.7 example (replaced with non-institutional accused); 'यौन मंशा तथ्य का प्रश्न' is the Explanation to s.11, not s.7 (attributed); SCC citation of Satish unverified -> replaced by verified Crl. Appeal No./INSC no.; weak circ link removed | Explanation to s.11 per bnblegal; Satish: https://en.wikipedia.org/wiki/Attorney_General_for_India_v._Satish (2021 INSC 762; Crl. Appeal 1410/2021; 18-11-2021) |
| 8 | 'Arnesh Kumar ... यहाँ सामान्यतः लागू माने जाते हैं' was vague; made it a rule statement (applies because max 5 yrs); example's 'सूचना परिवार व थाने के रिकार्ड में दी' unclear; holding of Arnesh sharpened; 'और जुर्माना' -> 'जुर्माना भी' (liable to fine) | in.json s.8; Arnesh Kumar (2014) 8 SCC 273 (well-known; not independently re-fetched); law_map CrPC 41A->BNSS 35 |
| 9 | Hindi compressed clauses (a)/(b) without the places/limbs, (j)(i) 'impairment' dropped, letters only in Hindi; 2019 clause (v) wording tightened; example said 'replaced s.7 by s.9' (charge is 9/10 in place of 7/8); law pair 'IPC 509' removed as weakly related, 354 added | in.json s.9; bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ ; bnblegal consolidated POCSO Act https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-act-2012/ |
| 10 | Hedged/vague 'सामान्यतः 5-7 वर्ष मानी जाती है' -> definitive: s.10 unchanged by the 2019 Act (list of amended sections 2,4,5,6,9,14,15,34,42,45) | bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ |
| 11 | Explanation 'sexual intent is a question of fact' belongs to s.11 (PDF merged it into s.12) - moved; (iii) and (vi) translated loosely; example cited '65B/63' ambiguously (IEA 65B vs BSA 63) and wrongly implied both apply | bnblegal consolidated Act (Explanation to s.11, s.12); in.json s.11-12; law_map IEA 65B->BSA 63 |
| 12 | Hindi listed the Explanation under s.12 (it is the Explanation to s.11); the garbled/cut PDF text now flagged in tip as required; weak SOP b2-19 removed, eve-teasing circular added | bnblegal consolidated Act s.11/s.12 |
| 13 | Example 2 claimed forwarding the clip 'is itself spreading (प्रसार)' - s.15(2) exempts reporting/evidence purpose, so claim overstated and softened; weak circ (media-briefing) link removed; 2019 definition cross-reference added | bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ (s.15(2) wording) |
| 14 | Old sub-sections (2)-(5) were presented as current-in-parallel to the new text; 14(2) did not say 'in addition to 14(1)'; example wrongly invoked s.42 (which compares POCSO with IPC, not ss.4/6/8/10) | bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ (s.14 as substituted) |
| 15 | 15(1) said 'पुलिस को बताने' (statute: 'designated authority, as may be prescribed'); 15(2) lacked 'for transmitting/displaying/distributing' purpose and the court-evidence exemption; 15(3) first conviction omitted 'or fine or both'; 15(1) is fine-only (stated); added Rule 11 and 2024 SC ruling | bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ (s.15 as substituted; s.45 new clauses); Just Rights for Children Alliance: https://www.scobserver.in/journal/supreme-court-holds-that-viewing-storing-and-possessing-child-pornography-is-punishable-under-pocso-act-overturns-madras-hc-decision/ ; Rule 11 title: https://www.scconline.com/blog/?p=226917 |
| 15 | Case added: Just Rights for Children Alliance v. S. Harish (2024 INSC 716) | scobserver link above; casemine title shows '2024 INSC 716' |
| 16 | Explanation III in Hindi omitted 'vulnerability', 'coercion' generally and the payments/benefits-for-consent limb; 'दूसरा' did not say 'in order to the doing of that offence'; explanation I omitted 'which he is bound to disclose' / 'attempts'; weak SOP link (rape-investigation SOP) removed | in.json s.16 |
| 17 | Only change: weak SOP link (b2-19 rape investigation) removed | title check refs.json |
| 18 | Hindi was muddled ('सजा के आधे तक की सजा... आजीवन का आधा...') and dropped 'or to cause such an offence to be committed'; 'IPC 511 की ज़रूरत नहीं' stated absolutely -> softened | in.json s.18 |
| 19 | Hindi 'अतिरिक्त' details: (4) 'wherever deemed necessary' added; (5) 'care and protection including shelter/hospital' made explicit; 3 law rows were duplicates of the same pair (merged to 2, the u:1 one verified: BNSS 173(1) proviso); POCSO Rules 2020 claim made specific (Rule 4 care/CWC/support person, Rule 6 medical); weak links removed (b2-18, circ ardh-dg-3-2013 which is murder/rape scene investigation); circ dg-16-2013 (woman officer records FIR/statement) added | in.json s.19; lawtimesjournal POCSO Rules 2020 summary https://lawtimesjournal.in/amendment-to-pocso-rule-2020-while-replacing-earlier-2012-rules/ ; BNSS 173 proviso (equivalent of CrPC 154(1) proviso) |
| 20 | Cut-off note moved into tip too (as instructed); example claimed 'सूचक का नाम गोपनीय रखा' as if mandated - softened (s.19(7) protection is for s.19(1) informants) | bnblegal s.20 'as the case may be'; in.json s.20 |
| 21 | Only change: weak SOP link (rape-investigation SOP) removed | title check |
| 22 | PDF/Hindi omitted s.22(3) (false complaint against a child by a non-child: up to 1 year/fine/both); weak SOP link removed | bnblegal consolidated POCSO Act https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-act-2012/ (s.22(3)); exact 'victimisation' wording from memory, flagged for India Code check |
| 23 | Example 1 said only 'इससे पुलिस की भी जिम्मेदारी बनी' (vague) - now cites s.33(7)/BNS 72; second law pair BNS 73 is in law_map (u:1 dropped); Nipun Saxena holding sharpened (FIR not in public domain; sealed cover; Special Court alone may permit disclosure for minors); weak SOP link removed | Nipun Saxena paras 50.1-50.8 https://judicialacademy.hp.gov.in/SCnipunsaxena.pdf ; law_map IPC 228A -> BNS 72, 73 |
| 24 | Example 1 said 'दिन में' (not in s.24) and implied calling a child to the PS at 8 pm is the only error - restated per s.24(1),(2),(4); Sakshi v. UOI cited for a police-statement section though it concerns courtroom testimony - removed; circ ardh-dg-11-2013 (juveniles in conflict with law) not relevant to a child victim's statement - dropped | in.json s.24; Sakshi case-brief https://www.thelegallock.com/resources/case-briefs/case-brief-sakshi-v-union-of-india-2004-5-scc-518 |
| 25 | 'यहाँ धारा नंबर की पुष्टि कर लें' left open -> verified BNSS 183(6)(a) (BNS 64-79, 124); proviso description clarified (it is the audio-video-in-presence-of-accused's-advocate proviso); u:1 removed | LiveLaw https://www.livelaw.in/amp/articles/comparison-between-section-183-bharatiya-nagarik-suraksha-sanhita-and-section-164-code-of-criminal-procedure-269492 |
| 26 | (1)/(3) Hindi slightly loose ('विश्वस्त व्यक्ति' ok); POCSO Rules 2020 claim now tied to rule numbers from secondary summary (Rule 5, Rule 4); SOP set re-chosen (audio-video recording relevant: digital evidence SOP, rape SOP b1-05; circ ardh-dg-3-2013 requires audio-video statements) | lawtimesjournal POCSO Rules 2020 summary https://lawtimesjournal.in/amendment-to-pocso-rule-2020-while-replacing-earlier-2012-rules/ ; https://theleaflet.in/criminal-justice/explained-role-of-support-persons-for-child-sexual-abuse-victims-under-pocso-rules-and-beyond (Rule 4(8)) |
| 27 | Hindi advice 'डॉक्टर को पीड़िता के नाम की जगह कोड/क्रमांक लिखने को कहें' had no legal basis and could break the medical record - removed; missing consent/24-hour rule of 164A(1)/BNSS 184(1) added; two duplicate CrPC 164A law rows merged (u:1 dropped); example implied FIR could wait until after medical - rewritten; weak circ link removed | BNSS 184(1) via https://www.prashantkanha.com/section-184-bnss-bhartiya-nagarik-suraksha-sanhita-2023-equivalent-cr-p-c-section/ ; s.27(4) wording from bnblegal |
| 28 | Example did not tie the correction to ss.28(2)/33(1) and used IPC numbers only; weak SOP link removed; Alakh Alok Srivastava kept (WP(C) 76/2018, 1-5-2018: HCs to ensure expeditious special-court disposal) - SCC citation (2018) 12 SCC 291 not independently confirmed | https://www.scconline.com/blog/post/2018/05/01/ensure-expeditious-disposal-of-cases-under-pocso-act-sc-to-high-courts/ |
| 29 | 'u:1' dropped (pair is in law_map); weak SOP links removed; 'बोझ खिसकता है' softened to 'आ सकता है' and attributed to court interpretation (no single citation verified) | law_map IEA 114A -> BSA 120 |
| 30 | Example/text treated 'आरोपी को आयु पता नहीं थी' as a mens-rea defence - POCSO's age element is not a culpable-mental-state element; replaced with s.5(q) (knowledge of pregnancy) which is; weak SOP link removed | in.json s.30, s.5(q) |
| 31 | CrPC 437 (bail by magistrate courts) is not the operative provision for a Special Court deemed a Court of Session - replaced by 438/439 mapping; circ dg-71-2013 (criminal-history in HC bail para-wise remarks) only marginally relevant - dropped | law_map CrPC 438->BNSS 482, 439->BNSS 483 |
| 32 | (2) 'अनुभव' -> 'प्रैक्टिस' per text; advice to 'meet' the child victim before testimony had no safeguard - qualified; law note clarified | in.json s.32 |
| 33 | Rules 2020 claim was generic ('interim compensation/पुनर्वास के प्रावधान'); now rule 8/9/10 with the 30-day payment; example 2 asserted court-order backing for coded copies - hedged ('न्यायालय के निर्देशानुसार'); Alakh Alok (speedy trial) not on point for s.33 - dropped; example 1 (IO asking court not to recall child) removed to keep max 2 examples; Sakshi holding sharpened; weak SOP removed | lawtimesjournal POCSO Rules 2020 summary https://lawtimesjournal.in/amendment-to-pocso-rule-2020-while-replacing-earlier-2012-rules/ ; Patna HC compensation slides https://www.patnahighcourt.gov.in/jjs/PDF/UPLOADED/208.PDF ; LiveLaw https://livelaw.in/news-updates/pocso-rules-2020-comes-into-force-153763 ; Sakshi brief https://www.thelegallock.com/resources/case-briefs/case-brief-sakshi-v-union-of-india-2004-5-scc-518 |
| 34 | 'POCSO Rules 2020 देखें' for age removed (no age rule found); JJ s.94 order now explicit; example 1 gave no legal anchor (JJ s.10: 24-hour production, no lock-up); example 2 was ambiguous on who determines age (Board/Special Court); heinous-offence/preliminary-assessment line tied to JJ s.15; weak SOP link removed; case P. Yuvaprakash added | JJ s.10: https://www.caseon.in/section/section-10-the-juvenile-justice-care-and-protection-of-children-act-2015 ; s.94: https://www.scconline.com/blog/?p=297286 ; s.34(1) 2015 substitution: bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ |
| 35 | Example said court 'ordered' testimony in 30 days - statute fixes 30 days from cognizance (s.35(1)); reworded | in.json s.35 |
| 36 | Only change: weak SOP link removed | title check |
| 37 | Nipun Saxena (identity non-disclosure) not on point for in-camera trial - replaced by Sakshi (in-camera/screen directions); example said police kept press 'away from the premises' (court's call) - reworded; weak circ link removed | Sakshi brief https://www.thelegallock.com/resources/case-briefs/case-brief-sakshi-v-union-of-india-2004-5-scc-518 |
| 38 | Only change: weak SOP link removed | title check |
| 39 | Hindi ⚠ said CWC appoints support person without consent; Rule 4(8) says with consent of child and parent/guardian (secondary sources); example said police 'demanded' the support person - reworded; weak SOP link removed | https://theleaflet.in/criminal-justice/explained-role-of-support-persons-for-child-sexual-abuse-victims-under-pocso-rules-and-beyond ; https://www.fighttrafficking.org/wp-content/uploads/2023/06/POCSO-GUIDEBOOK.pdf |
| 41 | 'दुरुपयोग हो तो अपराध बनेगा' was an unsupported gloss - restated as the plain condition (genuine medical exam/treatment AND parental/guardian consent); weak SOP link removed | in.json s.41 |
| 42 | The PDF's section list is the 2013 list; current s.42 also lists 376AB, 376B, 376DA, 376DB (bnblegal consolidated text) - Hindi presented the old list as the full list and the 'IT Act 67B' was the only update; BNS equivalents extended; 'India Code से मिलान' line dropped | bnblegal consolidated POCSO Act https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-act-2012/ (s.42 as printed) ; law_map |
| 42A | Added 'to the extent of inconsistency' (text) ; weak SOP link removed | in.json s.42A |
| 43 | Tip referred to 'मित्र पुलिस' (a scheme not verified) - removed; weak SOP link removed | unverifiable; refs title check |
| 44 | Only change: weak SOP link removed | title check |
| 45 | Hindi claimed Rules 2020 contain 'आयु निर्धारण' (no such rule found); 2019 amendment of s.45 (new (a),(aa); old (a)->(ab)) was missing; rule numbers now given from secondary summaries | bnblegal Amendment Act 25/2019 https://bnblegal.com/bareact/the-protection-of-children-from-sexual-offences-amendment-act-2019/ (s.45) ; lawtimesjournal POCSO Rules 2020 summary https://lawtimesjournal.in/amendment-to-pocso-rule-2020-while-replacing-earlier-2012-rules/ ; SCC Times (09-03-2020 notification): https://www.scconline.com/blog/?p=226917 |

## 2. Link / law / case diffs (computed)

| Sec | sop removed | sop added | circ removed | circ added | cases removed | cases added | law rows (old->new count) |
|---|---|---|---|---|---|---|---|
| 2 | sys-sop-up-b1-05, sys-sop-up-b2-19 | - | sys-circ-dg-70-2013 | - | - | P. Yuvaprakash v. State rep. by Inspector of Police | 2->2 |
| 5 | - | - | sys-circ-dg-16-2013 | - | - | - | 4->4 |
| 6 | sys-sop-up-b1-06 | - | - | - | - | - | 2->2 |
| 7 | - | - | sys-circ-ardh-dg-3-2013 | - | - | - | 1->1 |
| 8 | - | - | - | - | - | - | 2->3 |
| 12 | - | - | - | sys-circ-dg-7-2013 | - | - | 2->2 |
| 13 | - | - | sys-circ-dg-women-media-2013 | - | - | - | 2->2 |
| 15 | - | - | - | - | - | Just Rights for Children Alliance v. S. Harish | 2->2 |
| 16 | sys-sop-up-b2-19 | - | - | - | - | - | 3->3 |
| 17 | sys-sop-up-b2-19 | - | - | - | - | - | 1->1 |
| 19 | sys-sop-up-b2-18 | - | sys-circ-ardh-dg-3-2013 | sys-circ-dg-16-2013 | - | - | 3->2 |
| 21 | sys-sop-up-b2-19 | - | - | - | - | - | 1->1 |
| 22 | sys-sop-up-b2-19 | - | - | - | - | - | 2->2 |
| 23 | sys-sop-up-b2-19 | - | - | - | - | - | 2->2 |
| 24 | - | - | sys-circ-ardh-dg-11-2013 | sys-circ-ardh-dg-3-2013 | Sakshi v. Union of India | - | 2->2 |
| 26 | sys-sop-up-b2-19 | - | - | sys-circ-ardh-dg-3-2013 | - | - | 1->1 |
| 27 | - | - | sys-circ-ardh-dg-3-2013 | - | - | - | 2->1 |
| 28 | sys-sop-up-b2-19 | - | - | - | - | - | 3->3 |
| 29 | sys-sop-up-b1-05, sys-sop-up-b2-19 | - | - | - | - | - | 1->1 |
| 30 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |
| 31 | - | - | sys-circ-dg-71-2013 | - | - | - | 2->2 |
| 33 | sys-sop-up-b2-19 | - | - | - | Alakh Alok Srivastava v. Union of India | - | 2->2 |
| 34 | sys-sop-up-b2-19 | - | - | - | - | P. Yuvaprakash v. State rep. by Inspector of Police | 1->2 |
| 36 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |
| 37 | - | - | sys-circ-dg-women-media-2013 | - | Nipun Saxena v. Union of India | Sakshi v. Union of India | 2->2 |
| 38 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |
| 39 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |
| 41 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |
| 42 | - | - | - | - | - | - | 14->18 |
| 42A | sys-sop-up-b2-19 | - | - | - | - | - | 1->1 |
| 43 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |
| 44 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |
| 45 | sys-sop-up-b2-19 | - | - | - | - | - | 0->0 |

## 3. PDF text problems flagged in the layer (not invented)

- s.2(2): PDF sentence cut ('the Code or the Acts'); true list is IPC, CrPC, JJ Act (2015 after the 2019 amendment) and IT Act 2000 (advocatekhoj; CrPC term inferred, snippet truncated).
- ss.11/12: the Explanation 'sexual intent is a question of fact' belongs to s.11 but the PDF merged it into s.12; s.12 closing words garbled. Flagged in `tip` of s.12 and moved to s.11.
- s.20: cut at 'as the case may be'. Flagged in `hi` and `tip`.
- s.22: sub-section (3) (false complaint by an adult against a child, up to 1 year) missing from the PDF; added with a 'verify' note.
- s.27(4): PDF fragment garbled; meaning (woman nominated by head of medical institution) supplied from the consolidated Act and flagged.
- s.42: PDF list is the 2013 list; the current list also has 376AB, 376B, 376DA, 376DB and IT Act 67B.
- ss.4, 10: absent from PDF (original 2012 text used); s.10 verified unchanged by the 2019 Act (only ss.2, 4, 5, 6, 9, 14, 15, 34, 42, 45 were amended).

## 4. Items I could NOT fully verify (kept hedged, or kept with u:1)

1. **POCSO Rules 2020 rule numbers** (Rule 4 care/CWC, 4(8) support person, 5 interpreters etc., 6 medical, 7 legal aid, 8 special relief, 9 compensation incl. 30-day payment, 10 fine, 11 pornography reporting, 12 monitoring) come from secondary summaries (lawtimesjournal, The Leaflet, fighttrafficking guidebook, Patna HC slides, SCC Times, LiveLaw). The Gazette PDF (egazette.nic.in/WriteReadData/2020/218601.pdf) could not be fetched. The statement that Rules 2020 contain NO age-determination rule is an absence-inference from those summaries (the old claim was removed; no replacement claim made).
2. **Case citations not re-fetched**: Lalita Kumari (2014) 2 SCC 1, Arnesh Kumar (2014) 8 SCC 273 (well-known, from memory); Alakh Alok Srivastava (2018) 12 SCC 291 (WP(C) 76/2018, decided 01-05-2018 confirmed, the SCC volume/page not confirmed). Sakshi (2004) 5 SCC 518 and Independent Thought (2017) 10 SCC 800 confirmed by case-brief titles; Nipun Saxena (2019) 2 SCC 703 confirmed from the judgment copy (HP Judicial Academy PDF). Satish: SCC cite removed, replaced by Crl. Appeal 1410/2021 / 2021 INSC 762 / 18-11-2021 (Wikipedia). P. Yuvaprakash 2023 SCC OnLine SC 846 (SCC Online blog). Just Rights for Children Alliance 2024 INSC 716 (casemine title; decision date 23-09-2024 from SC Observer). All carry u:1.
3. **s.22(3)** exact wording (words 'thus resulting in victimisation') is from memory; the existence and 1-year maximum were confirmed on bnblegal.
4. **BNSS provisions from memory**: BNSS 173(1) proviso (woman officer records information; equivalent of CrPC 154(1) proviso), BNSS 173(2) free copy, BNSS 531 savings rule (investigations/trials pending on 1-7-2024 continue under CrPC; law_map confirms only that BNSS 531 = CrPC 484), BNSS 2 clause for 'public prosecutor' (left as 'BNSS 2'). Verified: BNSS 183(6)(a) (LiveLaw), BNSS 184(1) incl. 24 hours and consent (prashantkanha).
5. **JJ Act 2015**: s.10 (24 hours, no lock-up) and s.94(2) verified; s.15 preliminary assessment, 'heinous offence = min. 7 years' and s.74 (identity) are from memory.
6. **s.29 reading** ('presumption operates after foundational facts are proved') is mainstream judicial interpretation but no single judgment was verified; wording hedged to 'न्यायालयों की व्याख्या के अनुसार'.
7. **s.8 cognizable** (CrPC First Schedule Part II, 3-7 years class) from memory.
8. **BNS 65(1)/(2)** (under 16 / under 12) inferred from law_map (65 <- IPC 376(3), 376AB).
9. Bombay HC *Nagpur Bench* attribution for the skin-to-skin judgment: from memory.
10. 2019 Act commencement 16-08-2019 and 14-11-2012 (S.O. 2705(E)) come from bnblegal footnotes, not the Gazette.
11. s.2(2) full list and s.45 clause lettering ((a), (aa), (ab)) come from bnblegal snippets.
12. SOP/circular relevance was judged from titles and (for circulars) the stored summaries in `deliver/circulars_seed_*.json`; the SOP bodies were not re-read.

## 5. Not checked / out of scope
- Hindi grammar and style beyond legal fidelity.
- Whether Parliament has replaced 'child pornography' with 'CSEAM' after the 2024 SC suggestion (flagged in s.15 for India Code check).
