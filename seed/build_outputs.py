# -*- coding: utf-8 -*-
"""Leitet aus seed.json ab: schema.sql, seed.sql und gaeb/T-2026-014.x83"""
import json, io, hashlib

d = json.load(io.open("seed.json", encoding="utf-8"))
q = lambda s: "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"

# ------------------------------------------------------------------ schema.sql
schema = """-- BidDesk – D1-Schema (SQLite). Aus seed.json abgeleitet.
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
  status TEXT NOT NULL CHECK (status IN ('open','answered')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, id));

CREATE TABLE IF NOT EXISTS change_log (
  workspace_id TEXT NOT NULL, id INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
"""
io.open("schema.sql","w",encoding="utf-8").write(schema)

# -------------------------------------------------------------------- seed.sql
L = ["-- BidDesk – Seed. Aus seed.json erzeugt, NICHT von Hand aendern.",
     "-- '{{WS}}' vor der Ausfuehrung durch die Workspace-ID ersetzen.",
     "-- Fristen sind relativ (date('now', ...)) – laufen waehrend der Jurierung nie ab.",
     "INSERT OR IGNORE INTO workspaces (id) VALUES ('{{WS}}');"]

for t in d["tenders"]:
    L.append("INSERT INTO tenders (workspace_id,id,title_en,title_de,client_name,city,trade,status,due_date) VALUES "
             "('{{WS}}',%s,%s,%s,%s,%s,%s,%s,date('now','%+d day'));" % (
              q(t["id"]),q(t["title_en"]),q(t["title_de"]),q(t["client"]),q(t["city"]),q(t["trade"]),
              q(t["status"]),t["due_in_days"]))
    for i,p in enumerate(t["positions"]):
        L.append("INSERT INTO positions (workspace_id,tender_id,oz,sort_no,text_en,text_de,long_text_en,long_text_de,"
                 "quantity,unit,category,contingency) VALUES ('{{WS}}',%s,%s,%d,%s,%s,%s,%s,%s,%s,%s,%d);" % (
                  q(t["id"]),q(p["oz"]),i+1,q(p["text_en"]),q(p["text_de"]),
                  q(p["long_text_en"] or None),q(p["long_text_de"] or None),
                  p["quantity"],q(p["unit"]),q(p["category"]),1 if p["contingency"] else 0))

for b in d["bidders"]:
    L.append("INSERT INTO bidders (workspace_id,id,name,city,is_demo) VALUES ('{{WS}}',%s,%s,%s,%d);" % (
             q(b["id"]),q(b["name"]),q(b["city"]),1 if b["is_demo"] else 0))
for doc in d["documents"]:
    L.append("INSERT INTO bidder_documents (workspace_id,bidder_id,doc_type,label_en,label_de,valid_until) VALUES "
             "('{{WS}}',%s,%s,%s,%s,date('now','%+d day'));" % (
              q(doc["bidder_id"]),q(doc["doc_type"]),q(doc["label_en"]),q(doc["label_de"]),doc["valid_in_days"]))

for i,e in enumerate(d["price_book"]):
    pid = "PB-%s-%03d" % (e["bidder_id"].split("-")[1], i+1)
    L.append("INSERT INTO price_book (workspace_id,id,bidder_id,category,unit,keywords,unit_price,"
             "source_project,source_date,source_position_text) VALUES ('{{WS}}',%s,%s,%s,%s,%s,%.2f,%s,%s,%s);" % (
              q(pid),q(e["bidder_id"]),q(e["category"]),q(e["unit"]),
              q(json.dumps(e["keywords"],ensure_ascii=False)),e["unit_price"],
              q(e["source_project"]),q(e["source_date"]),q(e["source_position_text"])))

for bidder,prices in d["submitted_bids"].items():
    bid_id = "BID-009-%s" % bidder.split("-")[1]
    L.append("INSERT INTO bids (workspace_id,id,tender_id,bidder_id,status,submitted_at) VALUES "
             "('{{WS}}',%s,'T-2026-009',%s,'submitted',date('now','-38 day'));" % (q(bid_id),q(bidder)))
    for oz,pr in prices.items():
        L.append("INSERT INTO bid_prices (workspace_id,bid_id,oz,unit_price,set_by) VALUES "
                 "('{{WS}}',%s,%s,%.2f,'human');" % (q(bid_id),q(oz),pr))

# zwei versiegelte Konkurrenzangebote auf dem Haupt-Tender (Zaehler 2 -> 3 nach der Demo-Abgabe)
for bidder, prices in d.get("submitted_bids_t14", {}).items():
    bid_id = "BID-014-%s" % bidder.split("-")[1]
    L.append("INSERT INTO bids (workspace_id,id,tender_id,bidder_id,status,submitted_at) VALUES "
             "('{{WS}}',%s,'T-2026-014',%s,'submitted',datetime('now','-2 day'));" % (q(bid_id), q(bidder)))
    for oz, pr in prices.items():
        L.append("INSERT INTO bid_prices (workspace_id,bid_id,oz,unit_price,set_by) VALUES "
                 "('{{WS}}',%s,%s,%.2f,'human');" % (q(bid_id), q(oz), pr))

for c in d["clarifications"]:
    L.append("INSERT INTO clarifications (workspace_id,id,tender_id,bidder_id,oz,question,answer,status) VALUES "
             "('{{WS}}',%s,%s,%s,%s,%s,%s,%s);" % (
              q(c["id"]),q(c["tender_id"]),q(c["bidder_id"]),q(c["oz"]),q(c["question"]),q(c["answer"]),q(c["status"])))

io.open("seed.sql","w",encoding="utf-8").write("\n".join(L)+"\n")

# ---------------------------------------------------------------- GAEB X83
t = [x for x in d["tenders"] if x["id"]=="T-2026-014"][0]
CAT = {"01":("Preparatory works","Vorarbeiten"),"02":("Wall and ceiling coatings","Wand- und Deckenbeschichtungen"),
       "03":("Enamel work","Lackierarbeiten"),"04":("Contingency items","Bedarfspositionen")}
UNIT = {"m2":"m2","m":"m","pcs":"St","psch":"psch","h":"h"}
def esc(s): return (s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;"))
def gid(s): return "ID_" + hashlib.md5(s.encode()).hexdigest()[:12]

x = ['<?xml version="1.0" encoding="UTF-8"?>',
     '<!-- BidDesk Demo-Datei. Handgebaute, strukturtreue GAEB-DA-XML-3.2-Probe (DA83),',
     '     KEIN Export aus einem zertifizierten AVA-Programm. Importer defensiv schreiben. -->',
     '<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2">',
     '  <GAEBInfo>','    <Version>3.2</Version>','    <VersDate>2013-09-01</VersDate>',
     '    <Date>2026-08-31</Date>','    <Time>09:00:00</Time>',
     '    <ProgSystem>BidDesk Seed Generator</ProgSystem>','    <ProgName>build_outputs.py</ProgName>',
     '  </GAEBInfo>','  <PrjInfo>',
     '    <NamePrj>%s</NamePrj>' % esc(t["title_de"]),
     '    <LblPrj>%s</LblPrj>' % t["id"],
     '    <Cur>EUR</Cur>','    <CurLbl>EUR</CurLbl>','  </PrjInfo>',
     '  <Award>','    <DP>83</DP>','    <AwardInfo>',
     '      <Cur>EUR</Cur>','      <CurLbl>EUR</CurLbl>',
     '      <AwardNo>%s</AwardNo>' % t["id"],
     '      <OZMask>22222</OZMask>','    </AwardInfo>',
     '    <OWN>','      <Name>%s</Name>' % esc(t["client"]),
     '      <Address><City>%s</City></Address>' % esc(t["city"]),'    </OWN>',
     '    <BoQ ID="%s">' % gid(t["id"]),
     '      <BoQInfo>','        <Name>%s</Name>' % esc(t["title_de"]),
     '        <LblBoQ>%s</LblBoQ>' % t["id"],'        <Date>2026-08-31</Date>','      </BoQInfo>',
     '      <BoQBody>']
for cno in ["01","02","03","04"]:
    items = [p for p in t["positions"] if p["oz"].startswith(cno+".")]
    if not items: continue
    x += ['        <BoQCtgy ID="%s" RNoPart="%s">' % (gid(t["id"]+cno), cno),
          '          <LblTx>%s</LblTx>' % esc(CAT[cno][1]),
          '          <BoQBody>','            <Itemlist>']
    for p in items:
        rno = p["oz"].split(".")[1]
        x += ['              <Item ID="%s" RNoPart="%s">' % (gid(t["id"]+p["oz"]), rno)]
        if p["contingency"]:
            x += ['                <Provis>Yes</Provis>   <!-- Bedarfsposition; siehe seed/README.md -->']
        x += ['                <Qty>%s</Qty>' % ("%g" % p["quantity"]),
              '                <QU>%s</QU>' % UNIT[p["unit"]],
              '                <Description>','                  <CompleteText>',
              '                    <DetailTxt><Text><p><span>%s</span></p></Text></DetailTxt>' %
                  esc(p["long_text_de"] or p["text_de"]),
              '                    <OutlineText><OutlTxt><TextOutlTxt><span>%s</span></TextOutlTxt></OutlTxt></OutlineText>' %
                  esc(p["text_de"]),
              '                  </CompleteText>','                </Description>','              </Item>']
    x += ['            </Itemlist>','          </BoQBody>','        </BoQCtgy>']
x += ['      </BoQBody>','    </BoQ>','  </Award>','</GAEB>']
io.open("gaeb/T-2026-014.x83","w",encoding="utf-8").write("\n".join(x)+"\n")
print("schema.sql, seed.sql, gaeb/T-2026-014.x83 geschrieben")
