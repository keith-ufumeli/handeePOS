import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryAdjustment extends Document {
  storeId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  previousQuantity: number;
  newQuantity: number;
  delta: number;
  reason: 'sale' | 'restock' | 'adjustment' | 'return' | 'cancellation';
  orderId?: mongoose.Types.ObjectId;
  performedBy: string;
  createdAt: Date;
}

const InventoryAdjustmentSchema = new Schema<IInventoryAdjustment>(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    delta: { type: Number, required: true },
    reason: {
      type: String,
      required: true,
      enum: ['sale', 'restock', 'adjustment', 'return', 'cancellation'],
    },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    performedBy: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

InventoryAdjustmentSchema.index({ storeId: 1, createdAt: -1 });
InventoryAdjustmentSchema.index({ storeId: 1, productId: 1, createdAt: -1 });

export default mongoose.model<IInventoryAdjustment>('InventoryAdjustment', InventoryAdjustmentSchema);
