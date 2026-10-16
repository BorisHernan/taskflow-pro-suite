/** Con esta cantidad o menos, el producto se marca como "por agotarse" (tienda y estadísticas). */
export const STOCK_BAJO = 5;

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  // Clave de ícono (no un emoji): la resuelve <app-product-icon>.
  icon?: string;
  category: string;
  details?: string;
}

export interface Review {
  id: number;
  productId: number;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface NewReview {
  author: string;
  rating: number;
  comment: string;
}

export interface RatingSummary {
  productId: number;
  average: number;
  count: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  number: string;
  date: Date;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  total: number;
}

/** Cupones válidos de mentira, fijos en el frontend — solo afectan el total simulado. */
export const VALID_COUPONS: Record<string, number> = {
  BIENVENIDO10: 0.10,
  DEVOPS20: 0.20,
  PORTAFOLIO15: 0.15,
};
