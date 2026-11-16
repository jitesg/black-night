# InvestSuite कार्यालय / सिपाही — owner's requirements

Owner (2026-11-16): a separate app for the थाना कार्यालय (gives work) and later सिपाही (does work), connected to InvestSuite
(officers). The owner describes the कार्यालय and सिपाही work "बारी बारी" — every message is saved here AS WRITTEN (section
"मालिक के शब्द"), with a short summary under it. Nothing is built until the owner says so.

## अब तक तय (decided so far)
- Cloud: Supabase (owner's own free project, region chosen by owner). Project URL `https://pmezkxwkehjbyzxomlre.supabase.co`,
  publishable key `sb_publishable_YzOUIuRk5kLPz53I4jIcOg_J2B2ZwOC` (public, safe in the app). Never put the service / secret key
  or the DB password here. Sandbox cannot reach supabase.co — tables are created by the owner pasting SQL into the SQL Editor.
- Device: Android phone / tablet for the office (no web page / hosting).
- Owner wants a SEPARATE app for the office (role: काम देना to अधिकारी and सिपाही), joinable with InvestSuite now and later.
- Suggested (awaiting owner): same repo, two APKs (InvestSuite + "InvestSuite कार्यालय"), 6-digit code to link a person's app to
  the थाना, only status (not the आख्या / case data) goes back to the office, "काम" types extendable (प्रार्थना पत्र, न्यायालय, later
  सम्मन / वारंट / ड्यूटी), सिपाही role later.

## मालिक के शब्द (owner's descriptions, in order)

### 1. कार्यालय का काम (2026-11-16)
> कार्यालय का kaam 2 main रोल 1.HM 2. CM--- 1. न्यायलय ke कागज प्राप्त करना व कागज को सम्बंधित अधिकारी को अलॉट करना 2. RL,
> जनता दर्शन व अन्य प्रार्थना पत्रों को lena aur सम्बंधित अधिकारी को देना 3. सिपाहियों द्वारा सूचना मांगना aur तैयार करके भेजना
> अलग ऑफिसस मे 4. ड्यूटी लगाना......अभी यही 4 kaam रखो बाद मे बाकि जोड़ देंगे.... जरूरत ke हिसाब से....

सार: कार्यालय में 2 भूमिकाएँ — HM और CM. अभी 4 काम: (1) न्यायालय के कागज़ लेना + सम्बन्धित अधिकारी को allot करना;
(2) RL / जनता दर्शन / अन्य प्रार्थना पत्र लेना + अधिकारी को देना; (3) सिपाहियों से सूचना मँगाना, तैयार कर अलग-अलग कार्यालयों को
भेजना; (4) ड्यूटी लगाना. बाकी काम बाद में, ज़रूरत के हिसाब से.
