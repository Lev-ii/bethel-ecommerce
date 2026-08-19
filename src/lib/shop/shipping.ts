export interface ShippingQuote {
  zone: "abidjan" | "interieur";
  fee: number;
  label: string;
}

const ABIDJAN_CITIES = new Set([
  "abidjan",
  "cocody",
  "yopougon",
  "marcory",
  "treichville",
  "plateau",
  "adjame",
  "abobo",
  "koumassi",
  "port-bouet",
]);

export function quoteShipping(city: string): ShippingQuote {
  const normalized = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (ABIDJAN_CITIES.has(normalized)) {
    return { zone: "abidjan", fee: 2000, label: "Abidjan · sous 48 h" };
  }

  return { zone: "interieur", fee: 5000, label: "Interieur · selon disponibilite" };
}