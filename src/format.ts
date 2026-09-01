import type { Language } from "./types";

// German tender room: amounts and quantities read as they do on a real
// Leistungsverzeichnis (13.213,50 EUR) -- in BOTH languages, on purpose. The
// figures in this demo are quoted as fixed reference values in the spec, the
// README and seed/verify_seed.py; a thousands separator that moves with the
// interface language would make those numbers language-dependent for no gain.
// Dates carry no such reference value, so they follow the language.
const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const quantity = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 3
});

export const formatEuro = (value: number) => euro.format(value);
export const formatQuantity = (value: number) => quantity.format(value);

const dateLocale = (language: Language) => (language === "de" ? "de-DE" : "en-GB");

export const formatDate = (isoDate: string, language: Language = "en") =>
  new Intl.DateTimeFormat(dateLocale(language), {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00Z`));

/** "March 2026" / "März 2026" -- how a source chip names where a price came from. */
export const formatMonthYear = (isoDate: string, language: Language = "en") =>
  new Intl.DateTimeFormat(dateLocale(language), { month: "long", year: "numeric" }).format(
    new Date(`${isoDate}T00:00:00Z`)
  );
