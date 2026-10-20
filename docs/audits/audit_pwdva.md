# Audit: PWDVA 2005 teaching layer (wom/out/pwdva.json -> wom/out_v/pwdva.json)

Auditor: independent fact-check, web sources as listed. Entries changed: 31 of 38. Entry numbers/English untouched.

## Method
Each case was opened on a secondary/primary page (LiveLaw, SCC Online blog, Verdictum, legalauthority, hcraj.nic.in SC PDFs, lawfoyer, Karnataka HC judgment mirror, Delhi/Allahabad/Bombay HC reports). Rules 2006 text checked on Tripura govt PDF and bnblegal. law[] pairs checked against deliver/law_map.json (all map-present pairs matched; pairs absent from map keep/receive u:1 or are Act-to-Act). sop/circ ids checked by title.

## Change table
| Entry | Change | Source |
|---|---|---|
| * | case citations/holdings re-verified against sources and corrected (see audit table) |  |
| 0 | law label fixed: "दहेज प्रतिषेध/आत्महत्या-प्रेरण आदि (IPC 306)" -> "IPC 306" (matches law_map IPC306->BNS108) | deliver/law_map.json |
| 0 | example edited: समय-सीमा की आपत्ति | https://www.livelaw.in/amp/top-stories/limitation-period-us-468-crpc-not-applicable-application-us-12-domestic-violence-supreme-court-kamatchi-vs-lakshmi-narayanan-2022-livelaw-sc-370-196595 |
| 0 | example edited: विधवा का निवास-अधिकार | https://www.livelaw.in/amp/top-stories/joint-family-in-dv-act-means-members-living-together-as-family-not-as-understood-in-hindu-law-supreme-court-199912 |
| 1 | law u:1 removed - footnote on India Code mirror confirms Act 34/2019 s.95 + Fifth Schedule, w.e.f. 31.10.2019 | https://lawx.in/acts/section/10/140/1547 |
| 2 | hi: Krishna Bhattacharjee, 2016 -> Krishna Bhattacharjee, 20.11.2015 | https://hcraj.nic.in/sci/2015/4-1545-2015_2015-11-20.pdf |
| 2 | example edited: पृथक्करण के बाद | https://hcraj.nic.in/sci/2015/4-1545-2015_2015-11-20.pdf |
| 2 | example edited: पृथक्करण के बाद | https://hcraj.nic.in/sci/2015/4-1545-2015_2015-11-20.pdf |
| 3 | example edited: लिव-इन में आर्थिक हिंसा | https://thenewsminute.com/amp/story/news/live-partners-entitled-maintenance-under-domestic-violence-act-says-sc-90958 |
| 4 | Rule 4 (information to PO) added | https://socialwelfare.tripura.gov.in/sites/default/files/Protection-of-Women-from-Domestic-Violence-Rules_0.pdf |
| 5 | Lalita Kumari preliminary-inquiry limit corrected: layer said 15 days / 6 weeks; judgment says 7 days | https://www.livelaw.in/pdf_upload/lalitha-kumari-484405.pdf |
| 5 | BNSS 173(3) note added (statute text, u:1 in law[]) |  |
| 5 | example: 15 days/6 weeks -> 7 days; removed unverifiable "2014 में संशोधित" | https://www.livelaw.in/pdf_upload/lalitha-kumari-484405.pdf |
| 5 | example edited: संज्ञेय स्पष्ट नहीं | https://www.livelaw.in/pdf_upload/lalitha-kumari-484405.pdf |
| 6 | Rule 16(1)-(3) cited precisely | https://socialwelfare.tripura.gov.in/sites/default/files/Protection-of-Women-from-Domestic-Violence-Rules_0.pdf |
| 6 | hi: आश्रय का पता गोपनीय रखें — विशेषकर आरोपी -> आश्रय का पता गोपनीय रखें — विशेषकर आरोपी को न बताएँ (नियम 16 | https://socialwelfare.tripura.gov.in/sites/default/files/Protection-of-Women-from-Domestic-Violence-Rules_0.pdf |
| 6 | Ala Hazrat example: clarified it is an interim status-report order only | https://www.scconline.com/blog/post/2020/06/19/covid-19-all-hc-uttar-pradesh-government-to-file-status-report-on-measures-taken-to-address-domestic-violence-victims-grievances/ |
| 7 | unverified "free copy to victim under Rules" claim replaced with verified Rule 17(2)-(3) | https://socialwelfare.tripura.gov.in/sites/default/files/Protection-of-Women-from-Domestic-Violence-Rules_0.pdf |
| 7 | garbled phrase fixed |  |
| 8 | Rule 3(2)-(3) stated precisely (experience AND tenure) | https://bnblegal.com/bareact/protection-women-domestic-violence-rules-2006/ |
| 8 | Ala Hazrat example softened to what source verifies | https://www.scconline.com/blog/post/2020/06/19/covid-19-all-hc-uttar-pradesh-government-to-file-status-report-on-measures-taken-to-address-domestic-violence-victims-grievances/ |
| 9 | Rules 9 and 15(5) cited precisely | https://socialwelfare.tripura.gov.in/sites/default/files/Protection-of-Women-from-Domestic-Violence-Rules_0.pdf |
| 9 | law: "CrPC 125(3)/निष्पादन -> BNSS 144" corrected to CrPC 125(3) -> BNSS 144(3) (recovery warrant); map has no 125(3) key so u:1 |  |
| 9 | dropped sop b2-20 (husband harassment/suicide) and circ dg-16-2013 (crimes-against-women investigation): not about PO duties | reg/bk/refs.json |
| 9 | example edited: आर्थिक आदेश का पालन | https://www.verdictum.in/court-updates/high-courts/himachal-high-court/section-3-dv-act-penalises-breach-of-protection-order-not-monetary-order-2025-hhc-11017-akshay-thakur-v-state-of-hp-1576014 |
| 9 | Prabha Tyagi DIR example: bench/date added, wording tied to source | https://www.livelaw.in/amp/top-stories/joint-family-in-dv-act-means-members-living-together-as-family-not-as-understood-in-hindu-law-supreme-court-199912 |
| 9 | example edited: झूठी DIR | https://www.legalauthority.in/judgement/ashish-dixit-vs-state-of-u-p-6730 |
| 10 | removed overreaching inference ("इससे स्पष्ट है"), kept verified facts | https://www.scconline.com/blog/post/2020/06/19/covid-19-all-hc-uttar-pradesh-government-to-file-status-report-on-measures-taken-to-address-domestic-violence-victims-grievances/ |
| 12 | case name corrected (was "Rakash Nagardas Dubal Shaha v. Meena Prakash Dubal Shaha") and facts corrected (Sessions Court reversed; HC restored; SC dismissed husband appeal) | https://www.shoneekapoor.com/prakash-nagardas-dubal-shaha-vs-sou-meena-prakash-dubal-shah-and-ors/ |
| 12 | Suman Mishra facts corrected ("ननद" -> sister-in-law; procedural history; single-bench caveat) | https://www.verdictum.in/court-updates/high-courts/allahabad-lucknow-suman-mishra-v-the-state-of-up-2024-ahc-lko-52294-482-crpc-domestic-violence-act-1546825 |
| 12 | hi: इलाहाबाद उच्च न्यायालय (लखनऊ पीठ) ने Sum -> इलाहाबाद उच्च न्यायालय (लखनऊ पीठ, एकल पीठ) ने Suman Mishra v | https://www.verdictum.in/court-updates/high-courts/allahabad-lucknow-suman-mishra-v-the-state-of-up-2024-ahc-lko-52294-482-crpc-domestic-violence-act-1546825 |
| 12 | example edited: समय-सीमा का तर्क | https://www.livelaw.in/amp/top-stories/limitation-period-us-468-crpc-not-applicable-application-us-12-domestic-violence-supreme-court-kamatchi-vs-lakshmi-narayanan-2022-livelaw-sc-370-196595 |
| 12 | example edited: DIR के बिना सुनवाई | https://www.livelaw.in/amp/top-stories/joint-family-in-dv-act-means-members-living-together-as-family-not-as-understood-in-hindu-law-supreme-court-199912 |
| 12 | example edited: आवेदन संशोधन | https://livelaw.in/courts-not-powerless-allow-amendment-complaint-domestic-violence-act-sc |
| 13 | unverified "CrPC Chapter VI" statement replaced by verified Rule 12(2)(d) + s.28 link | https://bnblegal.com/bareact/protection-women-domestic-violence-rules-2006/ |
| 17 | example edited: विधवा का अधिकार | https://www.livelaw.in/amp/top-stories/joint-family-in-dv-act-means-members-living-together-as-family-not-as-understood-in-hindu-law-supreme-court-199912 |
| 17 | example edited: Senior Citizens Act | https://www.livelaw.in/amp/top-stories/right-of-woman-residence-shared-household-eviction-process-senior-citizens-act-supreme-court-domestic-violence-act-167267 |
| 17 | example edited: लखनऊ SDM आदेश | https://www.livelaw.in/amp/news-updates/oust-woman-matrimonial-home-summary-proceedings-senior-citizens-act-allahabad-high-court-185459 |
| 18 | split of HC views on s.31 vs maintenance added (Kerala 2022, HP 2025 vs Madras 2023) | https://www.scconline.com/blog/post/2022/12/15/legal-update-legal-news-no-penalty-under-section-31-domestic-violence-act-on-failure-to-pay-maintenance/ ; https://www.livelaw.in/amp/high-court/madras-high-court/madras-high-court-non-payment-of-maintenance-amount-to-breach-of-protection-order-under-dv-act-232156 |
| 18 | example edited: अंतरिम आदेश का उल्लंघन | https://www.lawweb.in/2019/06/whether-police-can-register-offence-us.html |
| 18 | example edited: निवास-आदेश बनाम protection | https://www.verdictum.in/court-updates/high-courts/himachal-high-court/section-3-dv-act-penalises-breach-of-protection-order-not-monetary-order-2025-hhc-11017-akshay-thakur-v-state-of-hp-1576014 |
| 18 | example edited: निवास-आदेश बनाम protection | https://www.livelaw.in/amp/high-court/madras-high-court/madras-high-court-non-payment-of-maintenance-amount-to-breach-of-protection-order-under-dv-act-232156 |
| 18 | example edited: ठोस भूमिका बिना नामजदगी | https://www.legalauthority.in/judgement/ashish-dixit-vs-state-of-u-p-6730 |
| 18 | example edited: मनमानी गिरफ्तारी नहीं |  |
| 19 | example edited: पति को हटने का आदेश |  |
| 19 | example edited: निवास का अधिकार, घरेलू संबंध आवश्यक | https://www.livelaw.in/amp/domestic-relationship-necessary-permit-party-occupy-shared-household-sc-read-judgment |
| 19 | example edited: ससुर के मकान पर आदेश | https://lawfoyer.in/satish-chander-ahuja-vs-sneha-ahuja/ |
| 19 | example edited: किराये का भुगतान | https://www.verdictum.in/court-updates/high-courts/himachal-high-court/section-3-dv-act-penalises-breach-of-protection-order-not-monetary-order-2025-hhc-11017-akshay-thakur-v-state-of-hp-1576014 |
| 20 | s.31 vs monetary orders: stated as split of HC views instead of settled rule | https://www.verdictum.in/court-updates/high-courts/himachal-high-court/section-3-dv-act-penalises-breach-of-protection-order-not-monetary-order-2025-hhc-11017-akshay-thakur-v-state-of-hp-1576014 ; https://www.scconline.com/blog/post/2022/12/15/legal-update-legal-news-no-penalty-under-section-31-domestic-violence-act-on-failure-to-pay-maintenance/ ; https://www.livelaw.in/amp/high-court/madras-high-court/madras-high-court-non-payment-of-maintenance-amount-to-breach-of-protection-order-under-dv-act-232156 |
| 20 | Shalu Ojha and Ajay Kumar holdings corrected | https://www.legalauthority.in/judgement/shalu-ojha-vs-prashant-ojha-5082 ; https://indialegallive.com/constitutional-law-news/supreme-court-news/brother-in-law-can-be-asked-to-pay-maintenance-under-domestic-violence-to-widow-wife-sc/ |
| 20 | Shalu Ojha example WRONG in layer (said SC told HC to be careful in interim interference); replaced with actual holding | https://www.legalauthority.in/judgement/shalu-ojha-vs-prashant-ojha-5082 |
| 20 | Ajay Kumar example: removed unverified "घर से बाहर रखा गया" fact, aligned with source | https://indialegallive.com/constitutional-law-news/supreme-court-news/brother-in-law-can-be-asked-to-pay-maintenance-under-domestic-violence-to-widow-wife-sc/ |
| 20 | example edited: live-in साथी | https://thenewsminute.com/amp/story/news/live-partners-entitled-maintenance-under-domestic-violence-act-says-sc-90958 |
| 20 | example edited: पति गायब | https://www.verdictum.in/court-updates/high-courts/himachal-high-court/section-3-dv-act-penalises-breach-of-protection-order-not-monetary-order-2025-hhc-11017-akshay-thakur-v-state-of-hp-1576014 |
| 20 | tip edited |  |
| 21 | Sham Kumbhakarna: judge name fixed, facts aligned with LiveLaw | https://www.livelaw.in/amp/permanent-custody-of-children-cant-be-ordered-in-proceedings-under-domestic-violence-act-bombay-hc-read-judgment |
| 21 | Karnataka HC example: procedural history and legal route corrected (HMGA, not Guardians & Wards Act; custody was granted by Sessions, not Magistrate) | https://fhwzizvulsqxfzkaqeia.supabase.co/storage/v1/object/public/judgments/section-21-pwdv-act-interim-custody-of-toddlers-mandatorily-granted-to-mother-in-domestic-violence-cases-karnataka-hc-c3296c.pdf |
| 21 | example edited: पिता की मुलाकात की अर्जी | https://www.livelaw.in/amp/father-can-file-application-u-s-21-of-domestic-violence-act-seeking-visitation-rights-to-child-bombay-hc-read-judgment |
| 22 | example edited: मुआवजा बरकरार | https://www.lawweb.in/2021/08/whether-concept-of-continuing-offence.html?m=0 |
| 23 | hi: Shalu Ojha (2014): मजिस्ट्रेट के भरण-पोष -> Shalu Ojha (सर्वोच्च न्यायालय, 2014): मजिस्ट्रेट के भरण-पोषण | https://www.legalauthority.in/judgement/shalu-ojha-vs-prashant-ojha-5082 |
| 23 | Shalu Ojha example in s.23 replaced (layer misstated holding) | https://www.legalauthority.in/judgement/shalu-ojha-vs-prashant-ojha-5082 |
| 23 | example edited: बिना DIR के आदेश |  |
| 23 | hi: प्रक्रिया: आदेश की प्रति धा. 24 से SHO क -> प्रक्रिया: आदेश की प्रति धा. 24 से SHO को निःशुल्क जाएगी; प् |  |
| 23 | dropped sop b2-18 (general police response) from interim/ex parte order procedure | reg/bk/refs.json |
| 20,21,22 | dropped sop b2-18 - civil monetary/custody/compensation relief procedures are not police-response topics | reg/bk/refs.json |
| 25 | hi: यानी इसकी कोई तय अवधि नहीं; मजिस्ट्रेट आ -> यानी इसकी कोई तय अवधि नहीं; यह अपने आप समाप्त नहीं होता। |  |
| 26 | example edited: तलाक के साथ निवास |  |
| 26 | example edited: Senior Citizens Tribunal | https://www.livelaw.in/amp/top-stories/right-of-woman-residence-shared-household-eviction-process-senior-citizens-act-supreme-court-domestic-violence-act-167267 |
| 27 | example edited: बेंगलुरु का मामला | https://www.livelaw.in/amp/top-stories/court-has-to-be-prima-facie-satisfied-dv-act-151898 |
| 27 | example edited: दिल्ली HC | https://www.scconline.com/blog/post/2025/03/05/delhi-high-court-rejects-air-force-officer-domestic-violence-case-quash-plea-legal-news/ |
| 27 | example edited: आदेश देशभर में |  |
| 28 | Suman Mishra example aligned with source | https://www.verdictum.in/court-updates/high-courts/allahabad-lucknow-suman-mishra-v-the-state-of-up-2024-ahc-lko-52294-482-crpc-domestic-violence-act-1546825 |
| 28 | hi: इलाहाबाद HC (लखनऊ पीठ) ने Suman Mishra ( -> इलाहाबाद HC (लखनऊ पीठ, एकल पीठ) ने Suman Mishra (2024) में ऐ | https://www.verdictum.in/court-updates/high-courts/allahabad-lucknow-suman-mishra-v-the-state-of-up-2024-ahc-lko-52294-482-crpc-domestic-violence-act-1546825 |
| 28 | example edited: आवेदन शिकायत नहीं | https://www.livelaw.in/amp/top-stories/limitation-period-us-468-crpc-not-applicable-application-us-12-domestic-violence-supreme-court-kamatchi-vs-lakshmi-narayanan-2022-livelaw-sc-370-196595 |
| 28 | example edited: दीवानी बनाम आपराधिक |  |
| 30 | hi: वहीं उनकी चूक पर भी लोक सेवक वाले दायित् -> वहीं PO की चूक पर धा. 33-34 लागू होती हैं (ये केवल Protectio |  |
| 31 | Rule 15 sub-rules cited precisely (layer had no rule numbers) | https://socialwelfare.tripura.gov.in/sites/default/files/Protection-of-Women-from-Domestic-Violence-Rules_0.pdf |
| 31 | split of HC views added | https://www.scconline.com/blog/post/2022/12/15/legal-update-legal-news-no-penalty-under-section-31-domestic-violence-act-on-failure-to-pay-maintenance/ ; https://www.livelaw.in/amp/high-court/madras-high-court/madras-high-court-non-payment-of-maintenance-amount-to-breach-of-protection-order-under-dv-act-232156 |
| 31 | hi: वैकल्पिक रास्ता: पीड़िता मजिस्ट्रेट के स -> वैकल्पिक रास्ता: पीड़िता मजिस्ट्रेट के समक्ष सीधे शिकायत भी  | https://www.lawweb.in/2019/06/whether-police-can-register-offence-us.html |
| 31 | Paul example: removed unverifiable order/incident dates (05/10.02.2019) and IPC section list; kept source-confirmed facts | https://www.lawweb.in/2019/06/whether-police-can-register-offence-us.html |
| 31 | example edited: केवल protection order | https://www.verdictum.in/court-updates/high-courts/himachal-high-court/section-3-dv-act-penalises-breach-of-protection-order-not-monetary-order-2025-hhc-11017-akshay-thakur-v-state-of-hp-1576014 |
| 31 | example edited: आदेश भरण-पोषण का | https://www.verdictum.in/court-updates/high-courts/himachal-high-court/section-3-dv-act-penalises-breach-of-protection-order-not-monetary-order-2025-hhc-11017-akshay-thakur-v-state-of-hp-1576014 |
| 31 | tip edited |  |
| 31 | dropped sop b2-20 (husband harassment/suicide) - not about breach of protection order | reg/bk/refs.json |
| 32 | hi: न्यायालयों की राय: केरल HC (Paul, 2019)  -> न्यायालयों की राय: केरल HC (Paul, 2019) — पुलिस धा. 31 में F | https://www.scconline.com/blog/post/2022/12/15/legal-update-legal-news-no-penalty-under-section-31-domestic-violence-act-on-failure-to-pay-maintenance/ ; https://www.livelaw.in/amp/high-court/madras-high-court/madras-high-court-non-payment-of-maintenance-amount-to-breach-of-protection-order-under-dv-act-232156 |
| 32 | example edited: संज्ञेय अपराध | https://www.lawweb.in/2019/06/whether-police-can-register-offence-us.html |
| 37 | hi: Form IV (अधिकारों की सूची) -> Form IV (पीड़िता के अधिकारों की जानकारी) | https://bnblegal.com/bareact/protection-women-domestic-violence-rules-2006/ |
| 9,20-23,31 | sop/circ links pruned for relevance (see rows above) | reg/bk/refs.json |

## Cases verified without change (core facts)
Hiral P. Harsora (06.10.2016, adult male + proviso struck); Satish Chander Ahuja (15.10.2020, 3-judge); Prabha Tyagi (12.05.2022); Kamatchi (13.04.2022); We The Women of India (20.05.2025: 6 weeks PO, 10 weeks shelter homes, service providers empanelled, NALSA); Khushboo Shukla; S. Vanitha; Juveria; Krishna Bhattacharjee; Prabhakar Bhatt v Annu Lamba; Sham Kumbhakarna; Kunapareddy; Ashish Dixit; Shyamlal Devda; Lalita Toppo; V.D. Bhanot; Velusamy; Indra Sarma; S.R. Batra (summaries via LiveLaw round-up).

## Could NOT be verified (left softened / flagged)
- SCC/AIR reporter numbers for several SC cases come from memory or secondary pages only (Hiral (2016) 10 SCC 165; Satish AIR 2020 SC 2483 seen; Bhanot, Velusamy, Indra Sarma, Batra, Rajnesh, Arnesh Kumar SCC cites; Kunapareddy AIR 2016 SC 2519 from a file name). All cases carry u:1 ("verify before court use").
- Exact judgment dates: Lalita Toppo (only "2018"), Ajay Kumar v Lata (only 2019), Prakash Nagardas Dubal-Shaha (only "2016" via LiveLaw round-up), Khushboo Shukla (report date Nov 2021), Akshay Thakur (report date May 2025), Shyamlal Devda (Jan 2020).
- Paul v. State of Kerala: layer's order/incident dates (05.02.2019/10.02.2019) and IPC list (294(b), 506, 323, 34) not found in any source - removed; only the facts in the LiveLaw/lawweb summary kept.
- Ala Hazrat Helping Society: only an interim status-report order is reported; no holding exists to cite.
- Allahabad High Court position on s.31 vs maintenance orders - not found; text tells officers to check it and take legal opinion (Kerala 2022, HP 2025 vs Madras 2023 split documented).
- BNSS 173(3) (14-day preliminary inquiry, DSP permission) stated from the statute text, not opened on the web in this audit; flagged u:1 in law[].
- Rules 2006 rule 12 (service of notice) text is garbled in available copies; only 12(2)(d) (Order V CPC consequences) is cited.
- UP machinery: only Raebareli District Probation Officer = PO + Dowry Prohibition Officer was confirmed (raebareli.nic.in). 112/181/1090/One Stop Centre (Sakhi) not re-verified here; current UP notifications of PO/shelters/service providers must be checked locally.
- Case names are retained as reported (public judgments); no further identifying detail (child names, addresses) was added; Karnataka HC child name in source deliberately omitted.
