// German tender room: amounts and quantities read as they do on a real
// Leistungsverzeichnis (13.213,50 EUR). Labels stay English for the jury.
const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const quantity = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 3
});

export const formatEuro = (value: number) => euro.format(value);
export const formatQuantity = (value: number) => quantity.format(value);

export const formatDate = (isoDate: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00Z`));
