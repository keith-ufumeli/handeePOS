import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';
import { ProductItem } from './Product';

export interface PaymentMethod {
  method: 'cash' | 'card' | 'mobile_money';
  amount: number;
  reference?: string;
}

export default class Order extends Model {
  static table = 'orders';

  @field('order_number') orderNumber!: string;
  @field('cashier_id') cashierId!: string;
  @field('customer_id') customerId?: string;
  @field('items') items!: string; // JSON string
  @field('subtotal') subtotal!: number;
  @field('tax_amount') taxAmount!: number;
  @field('discount_amount') discountAmount!: number;
  @field('total') total!: number;
  @field('payments') payments!: string; // JSON string
  @field('status') status!: string;
  @field('custom_note') customNote?: string;
  @field('sync_status') syncStatusField!: string;
  @field('last_synced_at') lastSyncedAt?: number;
  @field('server_id') serverId?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('completed_at') completedAt?: Date;

  // Helper methods
  get syncStatusValue(): string {
    return this.syncStatusField;
  }

  set syncStatusValue(value: string) {
    this.syncStatusField = value;
  }

  get orderItems(): ProductItem[] {
    try {
      return JSON.parse(this.items);
    } catch {
      return [];
    }
  }

  set orderItems(items: ProductItem[]) {
    this.items = JSON.stringify(items);
  }

  get paymentMethods(): PaymentMethod[] {
    try {
      return JSON.parse(this.payments);
    } catch {
      return [];
    }
  }

  set paymentMethods(payments: PaymentMethod[]) {
    this.payments = JSON.stringify(payments);
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isCancelled(): boolean {
    return this.status === 'cancelled';
  }
}
