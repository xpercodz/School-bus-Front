# i18n glossary — en / ar / fr

One row per term the UI shows more than once. A translator (human or model) who
follows this table is most of the way to a consistent interface. It is *not* a
dictionary of the shipped strings — those live in `src/lib/i18n/dictionaries/`.

## The product's own words

| English | Français | العربية | Note |
| --- | --- | --- | --- |
| student | élève | طالب | Epicene; never "étudiant" (school, not university). |
| bus | bus | حافلة | Invariable in French. "Bus 3" stays "Bus 3". |
| driver | conducteur | سائق | The person who drives. Not "chauffeur" — this is a staff account. |
| director | directeur | مدير | Role name. In running text, prefer rephrasing over gendering. |
| main director | directeur principal | المدير الرئيسي | The `owner` flag. |
| operator | opérateur | مشغّل | Office staff below the director. |
| run | trajet | رحلة | A morning or afternoon sweep of one bus. |
| roll | liste | الكشف | The list of every child, as opposed to one day's runs. |
| attendance | présence | الحضور | Not "assiduité" (that is a rate, not a record). |
| boarded | embarqué | صعد الحافلة | State after the child got on. |
| dropped off | descendu | نزل | State after the child got off. |
| absent | absent | غائب | |
| unaccounted | non comptabilisé | غير محتسب | The neutral state: no record yet. Never a warning word. |
| grade | niveau | الصف | School year, e.g. "Niveau 4". |
| school | école | المدرسة | |
| assignment | affectation | التعيين | A child's bus/driver. |
| access code | code d'accès | رمز الوصول | The 6-digit driver credential. |
| screen (permission) | écran | شاشة | An operator's granted pages. |
| activity log | journal d'activité | سجل النشاط | The audit trail. |
| entry (log) | entrée | مُدخل | One record in the log. |
| sheet import | importation d'un fichier | استيراد ملف | CSV/XLSX. |
| tour | visite guidée | جولة | The guided walkthrough. |
| guidebook | guide | الدليل | The manual page. |
| dispatch (a run) | lancer | إطلاق | Creating the day's run for a bus. |
| completed (run) | terminé | مكتمل | |

## Mechanics

- **Placeholders are code.** `{name}`, `{count}` and friends are substituted at
  runtime; copy them exactly, never translate their names.
- **Plurals.** A key with plural forms keeps the plural on the base key and the
  singular on `<key>.one`. French uses `one` for 0 and 1 (`Intl.PluralRules`),
  so the `.one` form must read correctly for both.
- **Sentence case**, no exclamation marks, no emoji.
- **French typography:** a space before `:` `;` `?` `!` and inside « », as the
  rest of the France-French UI does. Numbers format through `Intl` (`fr-FR`),
  so write digits as plain ASCII in the source.
- **Never hardcode a language name in a dictionary.** Endonyms ("English",
  "العربية", "Français") are identifiers, not translations.
- **Direction.** `fr` is LTR, like `en`. Only `ar` sets `dir="rtl"`, and any
  physical `left`/`right` in a component is a bug there regardless of locale.
