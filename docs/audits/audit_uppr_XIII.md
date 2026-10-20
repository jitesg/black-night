# Audit: Hindi teaching layer, UP Police Regulations Ch. XIII (paras 147-164)

Input: reg/out_v2/XIII.json. Output: reg/out_v2/XIII_v.json (17 entries, same order, `no` and English untouched).
Entries changed: 15 of 17 (147, 148, 149, 150, 152, 154, 155, 156, 157, 158, 160, 161, 162, 163, 164). Unchanged: 151, 159.
Validation script: reg/work3/val.py (valid JSON, 17/17, sop/circ ids exist, titles <=70 chars, 2-3 examples each, law[] pairs match law_map.json).
Fix script: reg/work3/fix.py.

## Cases checked (existence, citation, bench, holding)
| Case | Result | Source |
|---|---|---|
| Mihir Rajesh Shah v. State of Maharashtra, 2025 INSC 1288, 6.11.2025 | Confirmed. CJI Gavai and A.G. Masih J. Written grounds in every case, language understood; oral only in flagrante body/property offences, written copy at least 2 hrs before remand. Layer's exception wording was too broad; fixed. | https://www.verdictum.in/pdf_upload/mihir-rajesh-shah-v-state-of-maharashtrawatermark-1753569.pdf ; https://api.sci.gov.in/supremecourt/2024/56321/56321_2024_9_1502_65444_Order_06-Nov-2025.pdf |
| Satender Kumar Antil v. CBI, 2026 INSC 115, 15.1.2026 | Confirmed (Sundresh and N.K. Singh JJ). Holding as layer says. "CBI corruption / arrested without notice" facts rest only on one secondary source, so the example now states the holding only. | https://www.supremecourtcases.com/satender-kumar-antil-v-central-bureau-of-investigation-and-another-6/amp/ ; https://www.jsalaw.com/?p=57082 ; https://ksandk.com/criminal/bnss-section-35-arrest-rules/ |
| Satender Kumar Antil v. CBI, 21.1.2025 and 16.7.2025 (2025 SCC OnLine SC 1578) | Confirmed; added. WhatsApp/e-mail service of s.35 BNSS notice not valid. The layer's vague "2025 secondary source" line replaced. | https://www.scconline.com/blog/post/2025/07/31/supreme-court-section-35-bnss-notices-physical-service-mandate/ ; https://disputeresolution.cyrilamarchandblogs.com/2025/02/whatsapp-blocked-sc-directs-service-of-section-41a-crpc-notice-by-permissible-modes-only/ |
| Hyder Ali v. State of Karnataka | Exists as SLP(Crl) 18063/2024, dismissed 8.1.2025 (Dhulia and P.K. Mishra JJ); Hyder Ali was the complainant. The HC judgment is State of Karnataka v. Kalandar Shafi (Nagaprasanna J, 13.12.2024). Citation field was a placeholder; fixed. | https://www.livelaw.in/amp/top-stories/s187-bnss-supreme-court-affirms-hc-judgment-that-police-custody-must-be-within-first-40-days-for-offences-punishable-upto-10-yrs-imprisonment-280315 ; https://www.verdictum.in/court-updates/high-courts/karnataka-state-v-kalandar-shafi-section-187-bnss-167-crpc-new-regime-1562647 |
| Afreen Abubakar Tayal v. State of Maharashtra, 2025 SCC OnLine Bom 3207, 17.9.2025 | Confirmed (Kotwal and Chandak JJ); facts as in layer (no remand after 22.8.2025, s.189 report 11.9.2025, apology accepted). | https://www.scconline.com/blog/post/2025/09/22/bombay-hc-releases-detenue-io-fails-to-follow-s-189-bnss-mandate/ |
| K. Anandan Nambiar v. Chief Secretary, Madras, AIR 1966 SC 657, 27.10.1965 | Confirmed (5 judges; two MPs Nambiar and Umanath, DIR 30(1)(b)). Holding right; ex. text corrected (preventive detention; no claim that police have a "routine duty" from this case). | https://future.indiankanoon.org/doc/1740805 |
| Joginder Kumar (1994) 4 SCC 260, 25.4.1994 | Confirmed (Venkatachaliah CJ, Mohan, Anand JJ). Dropped the unverified "रिहाई कराई"; kept District Judge inquiry. | https://lawfoyer.in/joginder-kumar-v-state-of-u-p-1994/ |
| Arnesh Kumar (2014) 8 SCC 273 | Confirmed (Ghose and Prasad JJ, 2.7.2014). | https://lawfullegal.in/arnesh-kumar-v-state-of-bihar-anr-2014-8-scc-273/ |
| D.K. Basu (1997) 1 SCC 416 | Confirmed (Kuldip Singh and Anand JJ, 18.12.1996); 48-hr medical, memo, control room within 12 hrs. | https://legalvidhiya.com/dk-basu-v-state-of-west-bengal/ |
| Paramvir Singh Saini, SLP(Crl) 3543/2020, 2.12.2020 | Confirmed (Nariman, Joseph, Bose JJ). Ex. last sentence was wrong ("record to district committee"); the order says SHO reports the fault to the District Oversight Committee and sends arrest/interrogation details for the outage period. | https://www.livelaw.in/amp/top-stories/cctv-camera-every-police-station-supreme-court-directives-166709 |
| Citizens for Democracy v. State of Assam (1995) 3 SCC 743 | Confirmed (Kuldip Singh and Venkatachala JJ); 7 TADA detenues handcuffed in Guwahati hospital. | https://lawfoyer.in/citizens-for-democracy-vs-state-of-assam-and-ors/ |
| Prem Shankar Shukla (1980) 3 SCC 526 | Existence/holding confirmed indirectly (reaffirmed in Citizens for Democracy summary); facts not separately fetched. | same as above |
| Sheela Barse (1983) 2 SCC 96, 15.2.1983 | Confirmed (Bhagwati, Pathak, Sen JJ); directions as in layer. | https://legalvidhiya.com/sheela-barse-v-state-of-maharashtra/ |

## Changes table
| Para | Change | Why / source |
|---|---|---|
| 147 | hi[4]: replaced "match 41(1)/41(2) with s.35" with the actual modern equivalent of "arrest on another officer's information": BNSS 35(1)(j) requisition; noted CrPC 41(2)=BNSS 35(2) is the non-cognizable/warrant rule. | https://vidhijudicial.com/section-35-of-the-bharatiya-nagarik-suraksha-sanhita,-2023.html |
| 147 | hi[17]: removed Haryana Assembly rules 298-300 (irrelevant to UP, unverified). Law pair CrPC 86 -> BNSS 89 was substantively wrong (CrPC 86 / BNSS 89 = appeal on rejected restoration of attached property); replaced by CrPC 80/81 -> BNSS 82/83 (procedure after arrest on warrant). CrPC 79 -> BNSS 81 no longer marked unverified. | https://aaptaxlaw.com/bnss/83-bnss-procedure-by-magistrate-before-whom-such-person-arrested-is-brought-83-bnss-2023.html ; law_map.json |
| 147 | ex[1] Nambiar rewritten; cases list gives bench/citation. | indiankanoon link above |
| 148 | added CrPC 41B -> BNSS 36 (memo used in example). | law_map.json |
| 149 | ex[0] used theft with BNSS 35(1)(b) arrest, inconsistent with the notice-first rule; now a murder case (BNS 103). | s.35 text |
| 150 | hi[2]: 35(6) no longer said to require written reasons by itself; attributed to Antil 2026. hi[4]: WhatsApp line verified and corrected. ex[0] Joginder corrected. ex[1] now holding-only. ex[2] "420" (repealed IPC) -> BNS 318(4). New case added (2025 notice-service order). | sources above |
| 152 | hi[3]: BNSS 187 "ten years or more" nuance (Karnataka HC read as minimum 10 yrs; max-10-yr offences get 60 days, police custody in first 40 days); Kalandar Shafi named; UP position to be checked. hi[4]: Mihir exception narrowed; July 2026 larger-bench mooting (State of Meghalaya v. Sonam Raghuvanshi, 9.7.2026) stated as "considered", outcome unknown. hi[11]: BNSS 36 memo, 51(2) female RMP, DK Basu points; removed "consent" attribution to BNSS 51 (section has no consent clause). Law note for CrPC 53 fixed. ex[0], ex[1] details corrected. | https://www.livelaw.in/amp/top-stories/must-arrest-grounds-be-given-in-writing-supreme-court-says-judgments-are-conflicting-mulls-larger-bench-reference-540502 ; https://www.vidhijudicial.com/section-51-of-the-bharatiya-nagarik-suraksha-sanhita,-2023.html ; https://www.vidhijudicial.com/section-187-of-the-bharatiya-nagarik-suraksha-sanhita,-2023.html |
| 154 | hi[3]: added BNSS 49 receipt requirement and 49(2); law CrPC 100 -> BNSS 103 no longer "u"; ex[0] mentions receipt. | https://vidhijudicial.com/section-49-of-the-bharatiya-nagarik-suraksha-sanhita,-2023.html |
| 155 | hi[7]: 43(5) verified (hedge removed). ex[1] facts added/clarified; ex[2] BNSS 38 wording corrected (not "under supervision"); dropped circ dg-18-2013 (suicide prevention, not related to handcuffs/visits). | https://vidhijudicial.com/section-43-of-the-bharatiya-nagarik-suraksha-sanhita,-2023.html |
| 156 | hi[5] rewritten (old sentence was unclear); ex[1] was inconsistent (elderly woman arrested without recorded necessity); ex[2] duplicated the Bombay HC case from 152, now a generic BNSS 189 scenario. | BNSS 480 / 189 text |
| 157 | ex[0] Paramvir description corrected (see above). | LiveLaw link |
| 158 | ex[1] Sheela Barse directions made exact. | legalvidhiya link |
| 160 | hi[4]: 24-hour rule is BNSS 58 and Art. 22(2); BNSS 187 is the later remand. | https://vidhijudicial.com/section-58-of-the-bharatiya-nagarik-suraksha-sanhita,-2023.html |
| 161 | hi[1]: MHCA s.100 sub-sections verified ((3) 24 hrs, (4) no lock-up/prison, (7) missing-person FIR); "u" removed. | https://www.advocatekhoj.com/library/bareacts/mentalhealthcare/100.php |
| 162 | ex[0]: s.32 (24-hr information) and s.31 (CWC production) separated; "u" removed. | https://courtbook.in/the-juvenile-justice-care-and-protection-of-children-act-2015/section-32 |
| 163 | hi[1]: BNSS 51 (police request) added beside 53 (arrested person's request); law pair added. | BNSS 51 / 53 |
| 164 | hi[3]: s.10 does not say "not with adult accused" (that is s.23 no joint proceedings); s.12 bail is by police or Board, with 12(2) observation home; s.13 also probation officer. ex[0] "कपड़े" removed. | https://vidhijudicial.com/sec-10-to-26-chapter-iv-(procedure-in-relation-to-children-in-conflict-with-law)-the-juvenile-justice-act,-2015.html |

## BNSS provisions verified directly against text
35(1)-(7), 37, 40, 43(3),(5), 48, 49, 51, 58, 59, 82/83/89 titles, 187(1)-(10), 480(1)-(7). MHCA s.100. JJ Act ss.10, 12, 13, 23, 32.

## Unverifiable / not directly opened (left as in layer, matched to law_map.json only)
- BNSS 36, 38, 39, 45, 46, 47, 50, 53, 55, 56, 57, 189, 196, 478 (incl. "one week presumption of indigence"), 479, 481-483 wording: numbering matches law_map.json and sources cited in the layer, but I did not open the text of each.
- BNSS 35(1)(j) requisition conditions: summarised from a secondary page.
- BNSS 105 applicability to search of arrested persons (kept hedged as in layer).
- JJ Act s.7 (single Board member) used in an example without section number; not opened. JJ s.31 title only.
- Prem Shankar Shukla facts (undertrial, escort approval) not separately fetched.
- Allahabad HC / UP position on the Kalandar Shafi 40-day reading: not found; layer now says to check.
- Whether the Supreme Court actually referred the written-grounds question to a larger bench after 9.7.2026: not found.
- sop/circ links kept only where title relates; sys-circ-dg-33-2013 on para 148 is marginal (daabish/pursuit tactics).
