-- BidDesk – D1-Schema (SQLite). Aus seed.json abgeleitet.
-- Jede Tabelle traegt workspace_id: pro Besucher eine isolierte Kopie der Seed-Daten.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS tenders (
  workspace_id TEXT NOT NULL, id TEXT NOT NULL,
  title_en TEXT NOT NULL, title_de TEXT NOT NULL,
  client_name TEXT NOT NULL, city TEXT NOT NULL, trade TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','closed')),
  due_date TEXT NOT NULL,
  PRIMARY KEY (workspace_id, id));

CREATE TABLE IF NOT EXISTS positions (
  workspace_id TEXT NOT NULL, tender_id TEXT NOT NULL, oz TEXT NOT NULL,
  sort_no INTEGER NOT NULL,
  text_en TEXT NOT NULL, text_de TEXT NOT NULL,
  long_text_en TEXT, long_text_de TEXT,
  quantity REAL NOT NULL, unit TEXT NOT NULL, category TEXT NOT NULL,
  contingency INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, tender_id, oz));

CREATE TABLE IF NOT EXISTS bidders (
  workspace_id TEXT NOT NULL, id TEXT NOT NULL,
  name TEXT NOT NULL, city TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, id));

CREATE TABLE IF NOT EXISTS bidder_documents (
  workspace_id TEXT NOT NULL, bidder_id TEXT NOT NULL, doc_type TEXT NOT NULL,
  label_en TEXT NOT NULL, label_de TEXT NOT NULL, valid_until TEXT NOT NULL,
  PRIMARY KEY (workspace_id, bidder_id, doc_type));

CREATE TABLE IF NOT EXISTS price_book (
  workspace_id TEXT NOT NULL, id TEXT NOT NULL, bidder_id TEXT NOT NULL,
  category TEXT NOT NULL, unit TEXT NOT NULL, keywords TEXT NOT NULL, -- JSON-Array
  unit_price REAL NOT NULL,
  source_project TEXT NOT NULL, source_date TEXT NOT NULL, source_position_text TEXT NOT NULL,
  PRIMARY KEY (workspace_id, id));
CREATE INDEX IF NOT EXISTS idx_pb ON price_book (workspace_id, bidder_id, category, unit);

CREATE TABLE IF NOT EXISTS bids (
  workspace_id TEXT NOT NULL, id TEXT NOT NULL,
  tender_id TEXT NOT NULL, bidder_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted')),
  submitted_at TEXT,
  PRIMARY KEY (workspace_id, id));

CREATE TABLE IF NOT EXISTS bid_prices (
  workspace_id TEXT NOT NULL, bid_id TEXT NOT NULL, oz TEXT NOT NULL,
  unit_price REAL NOT NULL, note TEXT,
  set_by TEXT NOT NULL DEFAULT 'human' CHECK (set_by IN ('human','agent')),
  price_book_id TEXT,                      -- Herkunft, falls aus Vorschlag uebernommen
  PRIMARY KEY (workspace_id, bid_id, oz));

CREATE TABLE IF NOT EXISTS clarifications (
  workspace_id TEXT NOT NULL, id TEXT NOT NULL, tender_id TEXT NOT NULL,
  bidder_id TEXT NOT NULL, oz TEXT, question TEXT NOT NULL, answer TEXT,
  -- German only for seed rows. A question a person or an agent typed has no
  -- second language: nobody translates other parties' text, so these stay NULL
  -- and the Worker falls back to what was typed. Additive on purpose, so the
  -- live database took two ADD COLUMNs and no rename.
  question_de TEXT, answer_de TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','answered')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, id));

CREATE TABLE IF NOT EXISTS change_log (
  workspace_id TEXT NOT NULL, id INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
