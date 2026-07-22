export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  emoji?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ReceiptLine {
  name: string;
  emoji?: string;
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
