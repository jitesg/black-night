# Fact-check audits of the bundled law data

Owner-supplied audit reports (kept byte-for-byte). Each describes corrections made
to a teaching layer before it was bundled. The app's data already carries the
audited text (checked on 2026-10-20 against markers in each report):

| Report | Data in the app |
|---|---|
| audit_uppr_B1.md | `assets/seed/reg_seed_1.json`, `assets/reg/reg_index.json` (paras 97–146) |
| audit_uppr_XIII.md, audit_uppr_XIV_XVI.md | `assets/seed/reg_seed_2.json`, `reg_seed_3.json`, `assets/reg/reg_index.json` (L38, paras 147–189) |
| audit_pocso.md | `assets/seed/pocso_seed.json`, `assets/reg/pocso_index.json` |
| audit_pwdva.md | `assets/seed/women_seed_pwdva.json`, `assets/reg/women_index.json` |
| audit_posh.md | `assets/seed/women_seed_posh.json` |
| audit_itpa.md | `assets/seed/women_seed_itpa.json` |
| audit_dowry_irwa.md | `assets/seed/women_seed_dowry.json`, `assets/seed/women_seed_irwa.json` |

Items the auditors could not verify are listed at the end of each report; in the
app these carry the "सत्यापित करें" (u:1) flag or softened wording.
