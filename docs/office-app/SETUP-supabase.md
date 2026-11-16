# Supabase सेटअप — कार्यालय app (चरण 1)

Project: `https://pmezkxwkehjbyzxomlre.supabase.co` (मालिक का)। ये कदम मालिक खुद करेंगे — Claude का sandbox supabase.co तक नहीं पहुँचता।
**कभी न भेजें:** service_role / secret key, database password। सिर्फ़ publishable key (`sb_publishable_…`) app में जाती है।

## कदम 1 — बिना ईमेल के लॉगिन चालू करें
Supabase dashboard → बाएँ **Authentication** → **Sign In / Providers** → **"Allow anonymous sign-ins"** = ON → **Save**।
(हर फ़ोन बिना ईमेल-पासवर्ड के अपने-आप लॉगिन होगा; फिर कार्यालय का दिया 6 अंक का कोड उस फ़ोन को थाने के एक सदस्य से जोड़ेगा।)

## कदम 2 — database बनाएँ
बाएँ **SQL Editor** → **New query** → `sql/001_init.sql` की पूरी लिखावट चिपकाएँ → **Run**।
नीचे **"Success. No rows returned"** आना चाहिए। लाल error आए तो उसकी फ़ोटो भेजें।
(दोबारा चलाने से कुछ नहीं बिगड़ता।)

## कदम 3 — जाँच
**New query** → `sql/002_check.sql` चिपकाएँ → **Run** → 5 लाइनें आएँगी, सब में **"ठीक"** होना चाहिए। उस नतीजे की screenshot भेजें।

## कदम 4 — (वैकल्पिक) देख लें
- **Table Editor** में 7 टेबल: thanas, members, member_codes, claim_attempts, tasks, task_assignees, task_files (सब खाली)।
- **Storage** में bucket **task-files** (Private)।

## क्या बना (सरल शब्दों में)
| टेबल | काम |
|---|---|
| thanas | थाना (नाम, जनपद) |
| members | CM / HM / अधिकारी / सिपाही (नाम, पद, मोबाइल) |
| member_codes | हर सदस्य का 6 अंक का जोड़ने वाला कोड — सिर्फ़ कार्यालय देख सकता है, 7 दिन चलता है, एक बार इस्तेमाल |
| tasks | कार्यालय का भेजा कागज़ (न्यायालय / प्रार्थना पत्र), प्रकार, तिथियाँ, भरे खाने |
| task_assignees | किसे दिया + उसकी स्थिति (भेजा / मिला / देखा / निस्तारित / वापस / फ़ोन से हटाया) |
| task_files | कागज़ की फ़ोटो / PDF |

सुरक्षा: हर थाना सिर्फ़ अपना डेटा देखता है; अधिकारी सिर्फ़ अपने को दिया काम देखता है और सिर्फ़ उसकी स्थिति बदल सकता है;
गलत कोड 10 बार डालने पर 1 घंटे की रोक। ये सब `scripts/office/test_sql.sh` से local Postgres पर जाँचा गया है (27 जाँचें)।
