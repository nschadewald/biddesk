# -*- coding: utf-8 -*-
"""Erzeugt seed.json (Quelle der Wahrheit), seed.sql und die GAEB-X83-Beispieldatei.
Einmal laufen lassen; danach ist seed.json massgeblich - SQL und GAEB werden daraus abgeleitet."""
import json, io, uuid, datetime

# ---------------------------------------------------------------- Positionen
def P(oz, en, de, qty, unit, cat, cont=False, long_en="", long_de=""):
    return dict(oz=oz, text_en=en, text_de=de, quantity=qty, unit=unit,
                category=cat, contingency=cont, long_text_en=long_en, long_text_de=long_de)

T14 = [
 P("01.01","Site setup, protective covering of stairs, handrails and floors",
        "Baustelleneinrichtung, Abdecken von Treppen, Handläufen und Böden",1,"psch","prep",
        long_en="Includes delivery and removal of all equipment, covering of all surfaces not to be painted, daily cleaning of the staircase.",
        long_de="Einschließlich An- und Abtransport aller Geräte, Abdecken aller nicht zu behandelnden Flächen, tägliche Reinigung des Treppenhauses."),
 P("01.02","Clean and sand existing wall coating","Altanstrich Wandflächen reinigen und anschleifen",320,"m2","prep"),
 P("01.03","Fill cracks and holes, finish quality Q3","Risse und Löcher spachteln, Qualitätsstufe Q3",320,"m2","prep"),
 P("02.01","Primer on wall surfaces","Grundierung Wandflächen",320,"m2","wall"),
 P("02.02","Two coats washable emulsion paint, white, wall surfaces",
        "Wandflächen zweimal Dispersionsanstrich, waschbeständig, weiß",320,"m2","wall"),
 P("02.03","Two coats emulsion paint, ceilings","Deckenflächen zweimal Dispersionsanstrich",60,"m2","ceiling"),
 P("02.04","Protective latex coating on dado up to 1.50 m, colour per client",
        "Sockelanstrich Latex bis 1,50 m, Farbton nach Wahl des Auftraggebers",90,"m2","wall"),
 P("03.01","Steel balustrade: de-rust, prime, two coats alkyd enamel",
        "Treppengeländer Stahl: entrosten, grundieren, zweimal Lackanstrich",45,"m","metal"),
 P("03.02","Wooden handrail: sand and apply two coats clear varnish",
        "Handlauf Holz: schleifen, zweimal Klarlack",45,"m","wood"),
 P("03.03","Apartment entrance doors incl. frames: sand and two coats enamel",
        "Wohnungseingangstüren inkl. Zargen: schleifen, zweimal Lackanstrich",10,"pcs","wood"),
 P("03.04","Radiators incl. pipes: two coats radiator enamel",
        "Heizkörper inkl. Rohre: zweimal Heizkörperlack",4,"pcs","metal"),
 P("03.05","Window frames inside: sand and two coats enamel",
        "Fensterrahmen innen: schleifen, zweimal Lackanstrich",5,"pcs","wood"),
 P("04.01","Contingency: mould treatment on wall surfaces",
        "Bedarfsposition: Schimmelbehandlung Wandflächen",20,"m2","prep",True),
 P("04.02","Hourly rate skilled painter (contingency)",
        "Stundenlohnarbeiten Maler-Geselle (Bedarfsposition)",10,"h","labour",True),
]

T15 = [
 P("01.01","Site setup and covering, basement corridor","Baustelleneinrichtung und Abdecken, Kellergang",1,"psch","prep"),
 P("01.02","Remove loose coating, clean surfaces","Lose Anstriche entfernen, Flächen reinigen",95,"m2","prep"),
 P("02.01","Primer on mineral substrate","Grundierung auf mineralischem Untergrund",95,"m2","wall"),
 P("02.02","Two coats emulsion paint, basement walls","Kellerwände zweimal Dispersionsanstrich",95,"m2","wall"),
 P("02.03","Two coats emulsion paint, ceilings","Deckenflächen zweimal Dispersionsanstrich",42,"m2","ceiling"),
 P("03.01","Steel doors: de-rust and two coats enamel","Stahltüren: entrosten und zweimal Lackanstrich",3,"pcs","metal"),
]

T09 = [
 P("01.01","Facade scaffolding, erect and provide for 6 weeks","Fassadengerüst stellen und 6 Wochen vorhalten",240,"m2","prep"),
 P("01.02","Clean facade, low pressure","Fassade reinigen, Niederdruck",240,"m2","prep"),
 P("02.01","Repair cracks in render","Risse im Putz ausbessern",35,"m","prep"),
 P("02.02","Two coats silicone resin facade paint","Fassadenanstrich zweimal Silikonharzfarbe",240,"m2","wall"),
 P("03.01","Window sills: sand and two coats enamel","Fensterbänke schleifen und zweimal lackieren",12,"pcs","wood"),
]

tenders = [
 dict(id="T-2026-014", title_en="Staircase painting works – Rheinallee 12",
      title_de="Malerarbeiten Treppenhaus – Rheinallee 12",
      client="Rheinpark Property Management", city="Düsseldorf", trade="painting",
      status="open", due_in_days=10, positions=T14,
      note="Haupt-Demo. Frist relativ, damit sie waehrend der Jurierung (bis 21.09.) nie ablaeuft."),
 dict(id="T-2026-015", title_en="Basement corridor painting – Kaiserswerther Str. 88",
      title_de="Malerarbeiten Kellergang – Kaiserswerther Str. 88",
      client="Rheinpark Property Management", city="Düsseldorf", trade="painting",
      status="open", due_in_days=17, positions=T15,
      note="Nur damit list_tenders etwas zu filtern hat."),
 dict(id="T-2026-009", title_en="Facade repaint – Luegallee 40",
      title_de="Fassadenanstrich – Luegallee 40",
      client="Rheinpark Property Management", city="Düsseldorf", trade="painting",
      status="closed", due_in_days=-35, positions=T09,
      note="Abgeschlossen, drei abgegebene Angebote - fuettert den Preisspiegel sofort."),
]

# ---------------------------------------------------------------- Bieter
bidders = [
 dict(id="B-A", name="Farbwerk Meier GmbH", city="Düsseldorf", is_demo=True,
      profile="Demo-Bieter. Mittleres Preisniveau, gut gepflegtes Preisbuch – ABER zwei bewusste Lücken (Heizkörperlack, Stundenlohn)."),
 dict(id="B-B", name="Malerei Brandt & Sohn", city="Neuss", is_demo=False,
      profile="Vollständiges Preisbuch, Premium-Preise (~20–25 % über A)."),
 dict(id="B-C", name="Colorpoint Anstrich UG", city="Duisburg", is_demo=False,
      profile="Günstig, lückenhaftes Preisbuch (kein Metall, keine Stückpreise Holz)."),
]

documents = [
 ("B-A","trade_registration","Trade registration","Handwerkskarte",             365),
 ("B-A","liability_insurance","Liability insurance","Haftpflichtversicherung",  200),
 ("B-A","reference_project","Reference project","Referenzprojekt",              400),
 ("B-A","tax_clearance","Tax clearance certificate","Unbedenklichkeitsbescheinigung", -20),  # ABGELAUFEN -> check_bid meldet das
 ("B-B","trade_registration","Trade registration","Handwerkskarte",             300),
 ("B-B","liability_insurance","Liability insurance","Haftpflichtversicherung",  180),
 ("B-B","reference_project","Reference project","Referenzprojekt",              500),
 ("B-B","tax_clearance","Tax clearance certificate","Unbedenklichkeitsbescheinigung", 120),
 ("B-C","trade_registration","Trade registration","Handwerkskarte",             250),
 ("B-C","liability_insurance","Liability insurance","Haftpflichtversicherung",   90),
 ("B-C","tax_clearance","Tax clearance certificate","Unbedenklichkeitsbescheinigung", 60),
 # B-C fehlt bewusst das Referenzprojekt
]

# ---------------------------------------------------------------- Preisbuecher
def E(bid, cat, unit, kw, price, proj, date, txt):
    return dict(bidder_id=bid, category=cat, unit=unit, keywords=kw, unit_price=price,
                source_project=proj, source_date=date, source_position_text=txt)

price_book = [
 # --- Farbwerk Meier (Demo). KEINE Eintraege fuer metal/pcs und labour/h -> zwei Luecken im Haupt-LV.
 E("B-A","prep","psch",["baustelleneinrichtung","abdecken","treppenhaus"],480.00,"Luegallee 40","2026-03-14","Baustelleneinrichtung, Abdecken Treppenhaus und Böden"),
 E("B-A","prep","m2",["reinigen","anschleifen","altanstrich"],3.20,"Luegallee 40","2026-03-14","Altanstrich reinigen und anschleifen"),
 E("B-A","prep","m2",["spachteln","risse","q3"],6.80,"Kaiserswerther Str. 12","2025-11-08","Risse und Löcher spachteln, Q3"),
 E("B-A","wall","m2",["grundierung"],2.90,"Luegallee 40","2026-03-14","Grundierung Wandflächen"),
 E("B-A","wall","m2",["dispersionsanstrich","wand","weiß","waschbeständig"],8.40,"Luegallee 40","2026-03-14","Wandflächen zweimal Dispersionsanstrich weiß"),
 E("B-A","ceiling","m2",["dispersionsanstrich","decke"],9.10,"Grafenberger Allee 7","2025-09-22","Deckenflächen zweimal Dispersionsanstrich"),
 E("B-A","wall","m2",["sockelanstrich","latex"],14.20,"Luegallee 40","2026-03-14","Sockelanstrich Latex bis 1,50 m"),
 E("B-A","metal","m",["geländer","stahl","entrosten","lackanstrich"],28.50,"Grafenberger Allee 7","2025-09-22","Treppengeländer Stahl entrosten, grundieren, lackieren"),
 E("B-A","wood","m",["handlauf","holz","klarlack","schleifen"],19.80,"Grafenberger Allee 7","2025-09-22","Handlauf Holz schleifen und klarlackieren"),
 E("B-A","wood","pcs",["türen","zargen","lackanstrich"],148.00,"Kaiserswerther Str. 12","2025-11-08","Wohnungseingangstüren inkl. Zargen lackieren"),
 E("B-A","wood","pcs",["fensterrahmen","innen","lackanstrich"],88.00,"Kaiserswerther Str. 12","2025-11-08","Fensterrahmen innen lackieren"),
 E("B-A","prep","m2",["schimmel","behandlung"],18.50,"Grafenberger Allee 7","2025-09-22","Schimmelbehandlung Wandflächen"),
 # --- Brandt & Sohn: vollstaendig, Premium
 E("B-B","prep","psch",["baustelleneinrichtung","abdecken","treppenhaus"],650.00,"Bilker Allee 3","2026-01-20","Baustelleneinrichtung und Abdeckarbeiten"),
 E("B-B","prep","m2",["reinigen","anschleifen","altanstrich"],4.10,"Bilker Allee 3","2026-01-20","Untergrund reinigen und anschleifen"),
 E("B-B","prep","m2",["spachteln","risse","q3"],8.50,"Bilker Allee 3","2026-01-20","Spachtelarbeiten Q3"),
 E("B-B","wall","m2",["grundierung"],3.60,"Bilker Allee 3","2026-01-20","Grundierung Wandflächen"),
 E("B-B","wall","m2",["dispersionsanstrich","wand","weiß","waschbeständig"],10.20,"Bilker Allee 3","2026-01-20","Wandflächen zweimal Dispersion, waschbeständig"),
 E("B-B","ceiling","m2",["dispersionsanstrich","decke"],11.00,"Nordstr. 91","2025-10-05","Decken zweimal Dispersionsanstrich"),
 E("B-B","wall","m2",["sockelanstrich","latex"],17.50,"Nordstr. 91","2025-10-05","Sockel Latexanstrich bis 1,50 m"),
 E("B-B","metal","m",["geländer","stahl","entrosten","lackanstrich"],34.00,"Nordstr. 91","2025-10-05","Geländer Stahl entrosten und lackieren"),
 E("B-B","wood","m",["handlauf","holz","klarlack","schleifen"],24.50,"Nordstr. 91","2025-10-05","Handlauf Holz klarlackieren"),
 E("B-B","wood","pcs",["türen","zargen","lackanstrich"],185.00,"Bilker Allee 3","2026-01-20","Türen inkl. Zargen lackieren"),
 E("B-B","metal","pcs",["heizkörper","rohre","heizkörperlack"],96.00,"Nordstr. 91","2025-10-05","Heizkörper inkl. Rohre lackieren"),
 E("B-B","wood","pcs",["fensterrahmen","innen","lackanstrich"],110.00,"Bilker Allee 3","2026-01-20","Fensterrahmen innen lackieren"),
 E("B-B","prep","m2",["schimmel","behandlung"],22.00,"Nordstr. 91","2025-10-05","Schimmelsanierung Wandflächen"),
 E("B-B","labour","h",["stundenlohn","geselle"],62.00,"Bilker Allee 3","2026-01-20","Stundenlohnarbeiten Geselle"),
 # --- Colorpoint: guenstig, grosse Luecken
 E("B-C","prep","psch",["baustelleneinrichtung","abdecken"],390.00,"Moerser Str. 14","2025-08-11","Baustelleneinrichtung"),
 E("B-C","prep","m2",["reinigen","anschleifen","altanstrich"],2.60,"Moerser Str. 14","2025-08-11","Untergrund reinigen"),
 E("B-C","prep","m2",["spachteln","risse"],5.40,"Moerser Str. 14","2025-08-11","Spachtelarbeiten"),
 E("B-C","wall","m2",["grundierung"],2.35,"Moerser Str. 14","2025-08-11","Grundierung"),
 E("B-C","wall","m2",["dispersionsanstrich","wand","weiß"],6.90,"Moerser Str. 14","2025-08-11","Wandflächen zweimal Dispersion"),
 E("B-C","ceiling","m2",["dispersionsanstrich","decke"],7.50,"Duisburger Str. 60","2025-05-19","Decken Dispersionsanstrich"),
 E("B-C","wall","m2",["sockelanstrich","latex"],11.80,"Duisburger Str. 60","2025-05-19","Sockelanstrich Latex"),
 E("B-C","labour","h",["stundenlohn","geselle"],48.00,"Duisburger Str. 60","2025-05-19","Stundenlohnarbeiten"),
]

# ------------------------------------------------- abgegebene Angebote (T-2026-009)
bids_009 = {
 "B-A": {"01.01":11.50,"01.02":4.80,"02.01":16.00,"02.02":21.40,"03.01":74.00},
 "B-B": {"01.01":13.20,"01.02":5.90,"02.01":19.50,"02.02":25.80,"03.01":92.00},
 # Ausreisser bewusst gesetzt: 01.01 rund 2,4-fach -> Preisspiegel markiert ihn sofort
 "B-C": {"01.01":27.80,"01.02":3.90,"02.01":12.50,"02.02":17.20,"03.01":58.00},
}

clarifications = [
 dict(id="Q-001", tender_id="T-2026-014", bidder_id="B-A", oz="01.01",
      question="Will the scaffolding from the roofing works still be in place during our works, or do we have to provide our own access?",
      answer="The scaffolding will be removed on 15 September. Please price your own access equipment.",
      status="answered"),
 dict(id="Q-002", tender_id="T-2026-014", bidder_id="B-C", oz="02.04",
      question="Is the colour for the dado coating already decided? It affects the material price.",
      answer=None, status="open"),
]

data = dict(
  meta=dict(generated="2026-08-31", currency="EUR", note=(
     "Alle Firmen, Projekte und Preise sind erfunden (Demo-Daten, keine Marktdaten). "
     "Fristen sind RELATIV (due_in_days), damit sie waehrend der Jurierung bis 21.09.2026 nie ablaufen.")),
  tenders=tenders, bidders=bidders,
  documents=[dict(bidder_id=b, doc_type=t, label_en=le, label_de=ld, valid_in_days=d)
             for (b,t,le,ld,d) in documents],
  price_book=price_book, submitted_bids=bids_009, clarifications=clarifications,
  deliberate_gaps=dict(
    bidder="B-A",
    positions=["03.04","04.02"],
    reason=("Farbwerk Meier hat keinen Eintrag fuer metal/pcs (Heizkoerper) und keinen fuer labour/h (Stundenlohn). "
            "Der deterministische Matcher liefert dort confidence=none und KEINEN Preis. "
            "Das ist die Kernszene des Videos - diese beiden Zeilen bleiben leer, bis der Mensch sie eintraegt.")),
)
io.open("seed.json","w",encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2))
print("seed.json:", len(T14)+len(T15)+len(T09), "Positionen,", len(price_book), "Preisbuch-Eintraege")
