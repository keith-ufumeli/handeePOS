import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export interface ProductItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
}

export default class Product extends Model {
  static table = 'products';

  @field('name') name!: string;
  @field('sku') sku!: string;
  @field('barcode') barcode?: string;
  @field('category_id') categoryId!: string;
  @field('price') price!: number;
  @field('cost') cost!: number;
  @field('tax_rate') taxRate!: number;
  @field('stock_quantity') stockQuantity!: number;
  @field('low_stock_threshold') lowStockThreshold!: number;
  @field('unit') unit!: string;
  @field('images') images?: string;
  @field('is_active') isActive!: boolean;
  @field('sync_status') syncStatusField!: string;
  @field('last_synced_at') lastSyncedAt?: number;
  @field('server_id') serverId?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Helper methods
  get syncStatusValue(): string {
    return this.syncStatusField;
  }

  set syncStatusValue(value: string) {
    this.syncStatusField = value;
  }

  get isLowStock(): boolean {
    return this.stockQuantity <= this.lowStockThreshold;
  }

  get profitMargin(): number {
    if (this.cost === 0) return 0;
    return ((this.price - this.cost) / this.cost) * 100;
  }

  get imageUrls(): string[] {
    if (!this.images) return [];
    try {
      return JSON.parse(this.images);
    } catch {
      return [];
    }
  }

  set imageUrls(urls: string[]) {
    this.images = JSON.stringify(urls);
  }
}
