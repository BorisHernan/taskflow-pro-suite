import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { CartItem, Product, ReceiptData, VALID_COUPONS } from '../models/product.model';
import { ProductService } from '../services/product.service';
import { ProductIconComponent } from './product-icon/product-icon.component';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductIconComponent],
  templateUrl: './store.component.html',
  styleUrl: './store.component.scss',
})
export class StoreComponent implements OnInit, OnDestroy {
  products = signal<Product[]>([]);
  cart = signal<CartItem[]>([]);
  connectionLive = signal(false);
  errorMessage = signal<string | null>(null);
  receipt = signal<ReceiptData | null>(null);
  appliedCoupon = signal<{ code: string; discount: number } | null>(null);
  showCoupons = signal(false);
  couponInput = '';
  isCheckingOut = false;

  readonly availableCoupons = Object.entries(VALID_COUPONS).map(([code, discount]) => ({
    code,
    discount,
  }));

  private destroy$ = new Subject<void>();
  private errorTimeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.productService.getAll().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.showError('No se pudo cargar el catálogo. Verifica que el backend esté corriendo.'),
    });

    this.productService
      .streamUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.connectionLive.set(true);
          this.products.update((list) =>
            list.map((p) => (p.id === updated.id ? updated : p))
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.errorTimeoutId);
  }

  cartQuantity(productId: number): number {
    return this.cart().find((i) => i.product.id === productId)?.quantity ?? 0;
  }

  addToCart(product: Product): void {
    const alreadyInCart = this.cartQuantity(product.id);
    if (alreadyInCart >= product.stock) {
      this.showError(`Solo quedan ${product.stock} unidades de "${product.name}".`);
      return;
    }

    this.cart.update((items) => {
      const existing = items.find((i) => i.product.id === product.id);
      if (existing) {
        return items.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...items, { product, quantity: 1 }];
    });
  }

  changeQuantity(item: CartItem, delta: number): void {
    const newQuantity = item.quantity + delta;

    if (newQuantity <= 0) {
      this.cart.update((items) => items.filter((i) => i.product.id !== item.product.id));
      return;
    }

    if (newQuantity > item.product.stock) {
      this.showError(`Solo quedan ${item.product.stock} unidades de "${item.product.name}".`);
      return;
    }

    this.cart.update((items) =>
      items.map((i) => (i.product.id === item.product.id ? { ...i, quantity: newQuantity } : i))
    );
  }

  removeFromCart(item: CartItem): void {
    this.cart.update((items) => items.filter((i) => i.product.id !== item.product.id));
  }

  subtotal(): number {
    return this.cart().reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  }

  discountAmount(): number {
    const coupon = this.appliedCoupon();
    return coupon ? this.subtotal() * coupon.discount : 0;
  }

  total(): number {
    return this.subtotal() - this.discountAmount();
  }

  applyCoupon(): void {
    const code = this.couponInput.trim().toUpperCase();
    if (!code) return;

    const discount = VALID_COUPONS[code];
    if (discount === undefined) {
      this.showError(`El cupón "${this.couponInput}" no existe o ya no es válido.`);
      return;
    }

    this.appliedCoupon.set({ code, discount });
    this.couponInput = '';
  }

  removeCoupon(): void {
    this.appliedCoupon.set(null);
  }

  async checkout(): Promise<void> {
    const items = this.cart();
    if (items.length === 0 || this.isCheckingOut) return;

    this.isCheckingOut = true;
    const purchased: CartItem[] = [];

    for (const item of items) {
      try {
        await firstValueFrom(this.productService.purchase(item.product.id, item.quantity));
        purchased.push(item);
      } catch (err) {
        const already = purchased.length > 0
          ? ' Los productos anteriores de esta compra ya se descontaron del stock.'
          : '';
        this.showError(this.extractErrorMessage(err, `No se pudo completar la compra de "${item.product.name}".`) + already);
        this.cart.update((cartItems) =>
          cartItems.filter((c) => !purchased.some((p) => p.product.id === c.product.id))
        );
        this.isCheckingOut = false;
        return;
      }
    }

    this.buildReceipt(items);
    this.cart.set([]);
    this.appliedCoupon.set(null);
    this.isCheckingOut = false;
  }

  newPurchase(): void {
    this.receipt.set(null);
  }

  private buildReceipt(items: CartItem[]): void {
    const coupon = this.appliedCoupon();
    const subtotal = this.subtotal();
    const discount = this.discountAmount();

    this.receipt.set({
      number: 'TF-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date(),
      lines: items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        unitPrice: i.product.price,
        lineTotal: i.product.price * i.quantity,
      })),
      subtotal,
      discount,
      couponCode: coupon?.code,
      total: subtotal - discount,
    });
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse && err.error) {
      const body = err.error;
      if (typeof body === 'string' && body.trim()) return body;
      if (typeof body?.error === 'string') return body.error;
    }
    return fallback;
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    clearTimeout(this.errorTimeoutId);
    this.errorTimeoutId = setTimeout(() => this.errorMessage.set(null), 6000);
  }
}
