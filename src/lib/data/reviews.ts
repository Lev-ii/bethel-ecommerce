export interface ProductReview {
  id: string;
  productSlug: string;
  customer: string;
  rating: 4 | 5;
  title: string;
  body: string;
}

export const reviews: ProductReview[] = [
  {
    id: "review-1",
    productSlug: "trepied-telephone-160",
    customer: "Aïcha K.",
    rating: 5,
    title: "Très pratique",
    body: "Le trépied est stable et la livraison à Abidjan a été rapide.",
  },
  {
    id: "review-2",
    productSlug: "micro-cravate-sans-fil-duo",
    customer: "Moussa T.",
    rating: 5,
    title: "Son propre",
    body: "Simple à utiliser pour mes tournages et bon rapport qualité-prix.",
  },
  {
    id: "review-3",
    productSlug: "ring-light-18-pouces",
    customer: "Nadia B.",
    rating: 4,
    title: "Bonne lumière",
    body: "La lumière est régulière et le réglage de température est utile.",
  },
];

export function getProductReviews(productSlug: string): ProductReview[] {
  return reviews.filter((review) => review.productSlug === productSlug);
}