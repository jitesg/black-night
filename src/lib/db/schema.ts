// Database schema definitions for My Halka module
export const CREATE_TABLES_SQL = `
  -- app_migrations: one-time migration tracking flag table.
  -- Each row represents a named migration that has been successfully applied.
  -- migration_name TEXT PRIMARY KEY  — unique migration identifier (e.g. 'v250_executions_backfill')
  -- applied_at INTEGER               — Unix timestamp when the migration completed
  CREATE TABLE IF NOT EXISTS app_migrations (
    migration_name TEXT PRIMARY KEY,
    applied_at     INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS workspace_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    police_station TEXT NOT NULL DEFAULT '',
    district TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT '',
    halka TEXT NOT NULL DEFAULT '',
    beat TEXT NOT NULL DEFAULT '',
    officer_name TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS gram_panchayats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tehsil TEXT NOT NULL,
    police_station TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    remarks TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS hamlets (
    id TEXT PRIMARY KEY,
    gp_id TEXT NOT NULL REFERENCES gram_panchayats(id),
    name TEXT NOT NULL,
    population INTEGER,
    remarks TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS persons (
    id TEXT PRIMARY KEY,
    gp_id TEXT NOT NULL REFERENCES gram_panchayats(id),
    person_type TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    mobile TEXT,
    alternate_mobile TEXT,
    photo_uri TEXT,
    remarks TEXT,
    category TEXT,
    designation TEXT,
    related_entity_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS religious_places (
    id TEXT PRIMARY KEY,
    gp_id TEXT NOT NULL REFERENCES gram_panchayats(id),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    photo_uri TEXT,
    remarks TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS religious_authorities (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL REFERENCES religious_places(id),
    authority_type TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    mobile TEXT,
    alternate_mobile TEXT,
    photo_uri TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS religious_events (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL REFERENCES religious_places(id),
    event_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_date TEXT,
    description TEXT,
    expected_crowd INTEGER,
    remarks TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS social_institutions (
    id TEXT PRIMARY KEY,
    gp_id TEXT NOT NULL REFERENCES gram_panchayats(id),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    photo_uri TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS institution_heads (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES social_institutions(id),
    name TEXT NOT NULL,
    address TEXT,
    mobile TEXT,
    alternate_mobile TEXT,
    photo_uri TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS institution_staff (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES social_institutions(id),
    name TEXT NOT NULL,
    designation TEXT,
    mobile TEXT,
    alternate_mobile TEXT,
    photo_uri TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS liquor_shops (
    id TEXT PRIMARY KEY,
    gp_id TEXT NOT NULL REFERENCES gram_panchayats(id),
    shop_name TEXT NOT NULL,
    shop_type TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    mobile TEXT,
    alternate_mobile TEXT,
    licence_number TEXT,
    photo_uri TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS shop_staff (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES liquor_shops(id),
    name TEXT NOT NULL,
    mobile TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS firs (
    id TEXT PRIMARY KEY,
    fir_number TEXT NOT NULL,
    section TEXT NOT NULL,
    complainant_name TEXT NOT NULL,
    complainant_address TEXT,
    complainant_mobile TEXT,
    complainant_alt_mobile TEXT,
    complainant_jati TEXT,
    complainant_age TEXT,
    ghatnasthal TEXT,
    crime_type TEXT NOT NULL,
    date_of_occurrence TEXT,
    time_of_occurrence TEXT,
    date_of_information TEXT,
    time_of_information TEXT,
    nakal_chick TEXT,
    nakal_rapat TEXT,
    unknown_accused_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS fir_accused (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL REFERENCES firs(id),
    is_known INTEGER NOT NULL DEFAULT 1,
    name TEXT,
    address TEXT,
    mobile TEXT,
    alt_mobile TEXT,
    jati TEXT,
    age TEXT,
    bail_status TEXT NOT NULL DEFAULT 'unknown',
    remand_number TEXT,
    date_of_remand TEXT,
    next_remand_date TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS fir_karyvahi (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL REFERENCES firs(id),
    name TEXT NOT NULL,
    precautions TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS case_diaries (
    id TEXT PRIMARY KEY,
    fir_id TEXT NOT NULL REFERENCES firs(id),
    preparation_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS case_diary_karyvahi (
    id TEXT PRIMARY KEY,
    diary_id TEXT NOT NULL REFERENCES case_diaries(id),
    fir_karyvahi_id TEXT REFERENCES fir_karyvahi(id),
    karyvahi_name TEXT NOT NULL,
    vivran TEXT,
    format_used TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS predefined_formats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    format_type TEXT NOT NULL,
    vivran TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT 'me',
    last_used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS format_keys (
    id TEXT PRIMARY KEY,
    format_id TEXT NOT NULL REFERENCES predefined_formats(id),
    key_name TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    is_required INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,
    dropdown_options TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS format_tags (
    id TEXT PRIMARY KEY,
    format_id TEXT NOT NULL REFERENCES predefined_formats(id),
    tag TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS format_usage_log (
    id TEXT PRIMARY KEY,
    format_id TEXT NOT NULL REFERENCES predefined_formats(id),
    used_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    calling_module TEXT,
    generated_text TEXT,
    values_json TEXT
  );

  CREATE TABLE IF NOT EXISTS gd_entries (
    id TEXT PRIMARY KEY,
    preparation_date TEXT NOT NULL,
    ta_da_flag INTEGER NOT NULL DEFAULT 0,
    gd_type TEXT NOT NULL,
    vivran_content TEXT NOT NULL,
    format_id TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    attachment_uris TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS investigation_checklists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    crime_type TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    checklist_id TEXT REFERENCES investigation_checklists(id),
    serial_no INTEGER NOT NULL DEFAULT 0,
    task_name TEXT NOT NULL,
    brief_description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  -- ── M2M link: checklist item ↔ (crime_type, crime_subtype) pairs ──────────
  -- Replaces the old investigation_checklists ↔ checklist_items 1:M model.
  -- Each checklist item can now be linked to multiple (crime_type, crime_subtype)
  -- pairs so one item can appear for both crime types without DB duplication.
  -- The old tables remain untouched. This table is the new source of truth.
  CREATE TABLE IF NOT EXISTS checklist_item_subtypes (
    id TEXT PRIMARY KEY,
    checklist_item_id TEXT NOT NULL REFERENCES checklist_items(id),
    crime_type TEXT NOT NULL,
    crime_subtype TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_checklist_item_subtypes_pair
    ON checklist_item_subtypes(crime_type, crime_subtype);
  CREATE INDEX IF NOT EXISTS idx_checklist_item_subtypes_item
    ON checklist_item_subtypes(checklist_item_id);

  CREATE TABLE IF NOT EXISTS nirodhatmak_karyvahi (
    id TEXT PRIMARY KEY,
    format_id TEXT NOT NULL REFERENCES predefined_formats(id),
    format_title TEXT NOT NULL,
    report_text TEXT NOT NULL,
    values_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  -- ── Prarthna Patra Module ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS prarthna_patra (
    id TEXT PRIMARY KEY,
    registration_number TEXT NOT NULL UNIQUE,
    petition_type TEXT NOT NULL,
    date_of_receipt TEXT NOT NULL,
    deadline_date TEXT NOT NULL,
    matter TEXT NOT NULL DEFAULT '',
    investigator_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    disposal_date TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS prarthna_patra_complainants (
    id TEXT PRIMARY KEY,
    prarthna_patra_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    father_husband_name TEXT NOT NULL DEFAULT '',
    mobile TEXT NOT NULL DEFAULT '',
    alternate_mobile TEXT NOT NULL DEFAULT '',
    full_address TEXT NOT NULL DEFAULT '',
    village TEXT NOT NULL DEFAULT '',
    police_station TEXT NOT NULL DEFAULT '',
    district TEXT NOT NULL DEFAULT '',
    age TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    jati TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS prarthna_patra_accused (
    id TEXT PRIMARY KEY,
    prarthna_patra_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    father_name TEXT NOT NULL DEFAULT '',
    mobile TEXT NOT NULL DEFAULT '',
    alternate_mobile TEXT NOT NULL DEFAULT '',
    full_address TEXT NOT NULL DEFAULT '',
    village TEXT NOT NULL DEFAULT '',
    police_station TEXT NOT NULL DEFAULT '',
    district TEXT NOT NULL DEFAULT '',
    jati TEXT NOT NULL DEFAULT '',
    age TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS prarthna_patra_reports (
    id TEXT PRIMARY KEY,
    prarthna_patra_id TEXT NOT NULL UNIQUE,
    report_preparation_date TEXT NOT NULL,
    report_content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS pp_actions (
    id TEXT PRIMARY KEY,
    prarthna_patra_id TEXT NOT NULL,
    action_type TEXT NOT NULL DEFAULT '',
    action_date TEXT NOT NULL,
    action_content TEXT NOT NULL DEFAULT '',
    is_complete INTEGER NOT NULL DEFAULT 0,
    format_id TEXT,
    format_title TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  -- field_value_history: cross-module typing-suggestion index.
  -- Dedupe logic lives in fieldValueHistoryRepo.ts (UPSERT on field_key + LOWER(TRIM(value))).
  CREATE TABLE IF NOT EXISTS field_value_history (
    id           TEXT PRIMARY KEY,
    field_key    TEXT NOT NULL,
    value        TEXT NOT NULL,
    use_count    INTEGER NOT NULL DEFAULT 1,
    last_used_at INTEGER NOT NULL
  );

  -- phrase_library: Quick-insert common phrases for DocumentEditor
  CREATE TABLE IF NOT EXISTS phrase_library (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    phrase_text TEXT NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  -- NOTE: Idempotent column migrations are handled exclusively in database.ts
  -- via _ensureColumn() which probes for the column before altering.
  -- Raw ALTER TABLE statements have been removed from this SQL string to
  -- prevent duplicate-column warnings on every app restart after the first
  -- successful migration. All required columns for fir_karyvahi and
  -- knowledge_entries are managed by the _ensureColumn() calls in
  -- initializeSchema() in database.ts.

  -- v58: Nyayalay Module (Court Work) — three new tables
  CREATE TABLE IF NOT EXISTS nyayalay_documents (
    id TEXT PRIMARY KEY,
    registration_number TEXT NOT NULL UNIQUE,
    doc_type TEXT NOT NULL,
    sub_type TEXT,
    court_name TEXT NOT NULL DEFAULT '',
    vad_sankhya TEXT NOT NULL DEFAULT '',
    apradh_sankhya TEXT NOT NULL DEFAULT '',
    applicable_sections TEXT NOT NULL DEFAULT '',
    fir_number TEXT NOT NULL DEFAULT '',
    fir_year TEXT NOT NULL DEFAULT '',
    fir_ps TEXT NOT NULL DEFAULT '',
    matter TEXT NOT NULL DEFAULT '',
    document_title TEXT NOT NULL DEFAULT '',
    writ_type TEXT,
    deadline_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    checklist_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS nyayalay_persons (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    person_type TEXT NOT NULL DEFAULT 'accused',
    name TEXT NOT NULL DEFAULT '',
    father_name TEXT NOT NULL DEFAULT '',
    mobile TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS nyayalay_reports (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL UNIQUE,
    report_content TEXT NOT NULL DEFAULT '',
    report_date TEXT NOT NULL,
    format_title TEXT NOT NULL DEFAULT '',
    format_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS nyayalay_checklist_items (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    is_done INTEGER NOT NULL DEFAULT 0,
    is_optional INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  -- NOTE: v97 nirodhatmak_karyvahi column migrations moved to database.ts
  -- _ensureColumn() calls to prevent duplicate-column warnings on re-runs.

  -- v115: System Format Management — version history + audit log tables
  CREATE TABLE IF NOT EXISTS sys_format_versions (
    id TEXT PRIMARY KEY,
    format_id TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    vivran TEXT NOT NULL,
    format_type TEXT NOT NULL,
    sys_category TEXT NOT NULL DEFAULT '',
    sys_sub_category TEXT NOT NULL DEFAULT '',
    keys_snapshot TEXT NOT NULL DEFAULT '[]',
    tags_snapshot TEXT NOT NULL DEFAULT '[]',
    change_notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT NOT NULL DEFAULT 'owner'
  );

  CREATE TABLE IF NOT EXISTS sys_format_audit (
    id TEXT PRIMARY KEY,
    format_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    version_number INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT NOT NULL DEFAULT 'owner'
  );

  -- v121: System Knowledge Management — version history + audit log tables
  CREATE TABLE IF NOT EXISTS sys_knowledge_versions (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    subcategory TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    tags_snapshot TEXT NOT NULL DEFAULT '[]',
    keywords_snapshot TEXT NOT NULL DEFAULT '[]',
    metadata_snapshot TEXT NOT NULL DEFAULT '{}',
    change_notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT NOT NULL DEFAULT 'owner'
  );

  CREATE TABLE IF NOT EXISTS sys_knowledge_audit (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    version_number INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT NOT NULL DEFAULT 'owner'
  );

  -- v250: Karyvahi Executions — each execution of a fir_karyvahi via Case Diary
  -- execution_number is auto-incremented per fir_karyvahi_id at insert time (app-layer).
  CREATE TABLE IF NOT EXISTS karyvahi_executions (
    id               TEXT PRIMARY KEY,
    fir_karyvahi_id  TEXT NOT NULL REFERENCES fir_karyvahi(id),
    case_diary_id    TEXT NOT NULL REFERENCES case_diaries(id),
    case_id          TEXT NOT NULL,
    execution_number INTEGER NOT NULL DEFAULT 1,
    narrative_before TEXT,
    template_used    TEXT,
    generated_text   TEXT,
    officer          TEXT,
    created_at       INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ke_fir_karyvahi ON karyvahi_executions(fir_karyvahi_id);
  CREATE INDEX IF NOT EXISTS idx_ke_case_diary   ON karyvahi_executions(case_diary_id);
  CREATE INDEX IF NOT EXISTS idx_ke_case_id      ON karyvahi_executions(case_id);

  -- v250: Case Diary Entries — unified timeline (replaces case_diary_karyvahi as primary view)
  -- entry_type: 'karyvahi' | 'narrative'
  -- sequence_order preserves the exact chronological order the officer added entries.
  -- No restriction — narrative and karyvahi can appear in any order.
  CREATE TABLE IF NOT EXISTS case_diary_entries (
    id                  TEXT PRIMARY KEY,
    case_diary_id       TEXT NOT NULL REFERENCES case_diaries(id),
    entry_type          TEXT NOT NULL DEFAULT 'karyvahi',
    sequence_order      INTEGER NOT NULL DEFAULT 0,
    -- karyvahi-type fields
    linked_execution_id TEXT REFERENCES karyvahi_executions(id),
    fir_karyvahi_id     TEXT REFERENCES fir_karyvahi(id),
    karyvahi_name       TEXT,
    vivran              TEXT,
    format_used         TEXT,
    -- narrative-type fields
    narrative_text      TEXT,
    narrative_template  TEXT,
    created_at          INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at          INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at          INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_cde_diary ON case_diary_entries(case_diary_id);

  -- v121: Custom knowledge categories (owner-defined)
  CREATE TABLE IF NOT EXISTS sys_knowledge_custom_categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6B7280',
    icon_name TEXT NOT NULL DEFAULT 'FolderOpen',
    subcategories TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS surveillance_targets (
    id          TEXT PRIMARY KEY,
    gp_id       TEXT NOT NULL,
    gp_name     TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL,
    father_name TEXT NOT NULL DEFAULT '',
    criminal_activity TEXT NOT NULL DEFAULT '',
    photo_uri   TEXT,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    deleted_at  INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_surveillance_gp_id     ON surveillance_targets(gp_id);
  CREATE INDEX IF NOT EXISTS idx_surveillance_deleted_at ON surveillance_targets(deleted_at);

  -- ── Performance indexes ────────────────────────────────────────────────────
  -- firs: filter by status, sort by created_at, look up by fir_number
  CREATE INDEX IF NOT EXISTS idx_firs_status      ON firs(status);
  CREATE INDEX IF NOT EXISTS idx_firs_created_at  ON firs(created_at);
  CREATE INDEX IF NOT EXISTS idx_firs_fir_number  ON firs(fir_number);
  CREATE INDEX IF NOT EXISTS idx_firs_deleted_at  ON firs(deleted_at);

  -- fir_karyvahi: all lookups are by fir_id
  CREATE INDEX IF NOT EXISTS idx_fir_karyvahi_fir ON fir_karyvahi(fir_id);

  -- case_diaries: joined to firs by fir_id
  CREATE INDEX IF NOT EXISTS idx_case_diaries_fir ON case_diaries(fir_id);

  -- gd_entries: filter by gd_type, sort by preparation_date / created_at
  CREATE INDEX IF NOT EXISTS idx_gd_entries_gd_type        ON gd_entries(gd_type);
  CREATE INDEX IF NOT EXISTS idx_gd_entries_created_at     ON gd_entries(created_at);
  CREATE INDEX IF NOT EXISTS idx_gd_entries_prep_date      ON gd_entries(preparation_date);
  CREATE INDEX IF NOT EXISTS idx_gd_entries_deleted_at     ON gd_entries(deleted_at);

  -- nirodhatmak_karyvahi: filter by created_at, deleted_at
  CREATE INDEX IF NOT EXISTS idx_nirodhatmak_created_at    ON nirodhatmak_karyvahi(created_at);
  CREATE INDEX IF NOT EXISTS idx_nirodhatmak_deleted_at    ON nirodhatmak_karyvahi(deleted_at);

  -- nyayalay_documents: filter by status, doc_type, deadline_date, fir_number
  CREATE INDEX IF NOT EXISTS idx_nyl_docs_status           ON nyayalay_documents(status);
  CREATE INDEX IF NOT EXISTS idx_nyl_docs_doc_type         ON nyayalay_documents(doc_type);
  CREATE INDEX IF NOT EXISTS idx_nyl_docs_deadline         ON nyayalay_documents(deadline_date);
  CREATE INDEX IF NOT EXISTS idx_nyl_docs_fir_number       ON nyayalay_documents(fir_number);
  CREATE INDEX IF NOT EXISTS idx_nyl_docs_deleted_at       ON nyayalay_documents(deleted_at);

  -- nyayalay_persons: joined to documents by doc_id
  CREATE INDEX IF NOT EXISTS idx_nyl_persons_doc           ON nyayalay_persons(doc_id);

  -- prarthna_patra: filter by status, petition_type, dates
  CREATE INDEX IF NOT EXISTS idx_pp_status                 ON prarthna_patra(status);
  CREATE INDEX IF NOT EXISTS idx_pp_petition_type         ON prarthna_patra(petition_type);
  CREATE INDEX IF NOT EXISTS idx_pp_date_of_receipt       ON prarthna_patra(date_of_receipt);
  CREATE INDEX IF NOT EXISTS idx_pp_deadline_date         ON prarthna_patra(deadline_date);
  CREATE INDEX IF NOT EXISTS idx_pp_deleted_at            ON prarthna_patra(deleted_at);

  -- predefined_formats: filter by format_type, source, is_favorite
  CREATE INDEX IF NOT EXISTS idx_formats_format_type      ON predefined_formats(format_type);
  CREATE INDEX IF NOT EXISTS idx_formats_is_favorite      ON predefined_formats(is_favorite);
  CREATE INDEX IF NOT EXISTS idx_formats_deleted_at       ON predefined_formats(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_formats_last_used_at     ON predefined_formats(last_used_at);

  -- format_usage_log: used for most-recently-used lookups per format
  CREATE INDEX IF NOT EXISTS idx_format_usage_format_id   ON format_usage_log(format_id);
  CREATE INDEX IF NOT EXISTS idx_format_usage_used_at     ON format_usage_log(used_at);

  -- phrase_library: filter by category, sort by usage and created_at
  CREATE INDEX IF NOT EXISTS idx_phrase_category          ON phrase_library(category);
  CREATE INDEX IF NOT EXISTS idx_phrase_deleted_at        ON phrase_library(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_phrase_usage             ON phrase_library(usage_count);
`;

// Person types
export const PERSON_TYPES = {
  CURRENT_PRADHAN: 'current_pradhan',
  FORMER_PRADHAN: 'former_pradhan',
  BDC: 'bdc',
  IMPORTANT: 'important',
  RELIGIOUS_AUTHORITY: 'religious_authority',
  HISTORY_SHEETER: 'history_sheeter',
  INSTITUTION_HEAD: 'institution_head',
  INSTITUTION_STAFF: 'institution_staff',
} as const;

export const RELIGIOUS_CATEGORIES = ['Temple', 'Mosque', 'Church', 'Gurudwara', 'Other'] as const;

export const AUTHORITY_LABELS: Record<string, string> = {
  Temple: 'Priest (Pujari)',
  Mosque: 'Maulvi',
  Church: 'Father',
  Gurudwara: 'Granthi / Chief Priest',
  Other: 'Responsible Person',
};

export const INSTITUTION_CATEGORIES = [
  'Primary School',
  'Secondary School',
  'Inter College',
  'Degree College',
  'Bank',
  'Other',
] as const;

export const SHOP_TYPES = ['Wine Shop', 'Beer Shop', 'Country Liquor Shop', 'Bar', 'Other'] as const;

export const EVENT_TYPES = ['Fair', 'Festival', 'Other'] as const;

export const IMPORTANT_PERSON_CATEGORIES = [
  'Political Leader',
  'Social Worker',
  'Doctor',
  'Lawyer',
  'Teacher',
  'Businessman',
  'Religious Leader',
  'Other',
] as const;
