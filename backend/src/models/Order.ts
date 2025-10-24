import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
}

export interface IPaymentMethod {
  method: 'cash' | 'card' | 'mobile_money';
  amount: number;
  reference?: string;
}

export interface IOrder extends Document {
  _id: string;
  orderNumber: string;
  storeId: mongoose.Types.ObjectId;
  cashierId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  payments: IPaymentMethod[];
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  customNote?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  deviceId?: string;
  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  }
}, { _id: false });

const PaymentMethodSchema = new Schema<IPaymentMethod>({
  method: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: {
      values: ['cash', 'card', 'mobile_money'],
      message: 'Payment method must be one of: cash, card, mobile_money'
    }
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  reference: {
    type: String,
    trim: true
  }
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: [true, 'Order number is required'],
    unique: true,
    trim: true
  },
  storeId: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'Store ID is required'],
    index: true
  },
  cashierId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Cashier ID is required'],
    index: true
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    index: true
  },
  items: [OrderItemSchema],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  taxAmount: {
    type: Number,
    required: [true, 'Tax amount is required'],
    min: [0, 'Tax amount cannot be negative']
  },
  discountAmount: {
    type: Number,
    required: [true, 'Discount amount is required'],
    min: [0, 'Discount amount cannot be negative']
  },
  total: {
    type: Number,
    required: [true, 'Total is required'],
    min: [0, 'Total cannot be negative']
  },
  payments: [PaymentMethodSchema],
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'completed', 'cancelled', 'refunded'],
      message: 'Status must be one of: pending, completed, cancelled, refunded'
    },
    default: 'pending',
    index: true
  },
  customNote: {
    type: String,
    trim: true,
    maxlength: [500, 'Custom note cannot exceed 500 characters']
  },
  syncStatus: {
    type: String,
    required: [true, 'Sync status is required'],
    enum: {
      values: ['synced', 'pending', 'failed'],
      message: 'Sync status must be one of: synced, pending, failed'
    },
    default: 'pending',
    index: true
  },
  deviceId: {
    type: String,
    trim: true
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(_doc, ret) {
      const { __v, ...cleanRet } = ret;
      return cleanRet;
    }
  }
});

// Compound indexes for performance
OrderSchema.index({ storeId: 1, createdAt: -1 });
OrderSchema.index({ storeId: 1, status: 1 });
OrderSchema.index({ storeId: 1, cashierId: 1 });
OrderSchema.index({ storeId: 1, syncStatus: 1 });
// Note: orderNumber already has unique: true which creates an index automatically

// Pre-save middleware to generate order number
OrderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
        // Find the last order for today
        const OrderModel = mongoose.model('Order');
        const lastOrder = await OrderModel.findOne({
          orderNumber: { $regex: `^ORD-${dateStr}-` }
        }).sort({ orderNumber: -1 });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    this.orderNumber = `ORD-${dateStr}-${sequence.toString().padStart(3, '0')}`;
  }
  next();
});

// Pre-save middleware to calculate totals
OrderSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.taxAmount = this.items.reduce((sum, item) => sum + item.tax, 0);
    this.discountAmount = this.items.reduce((sum, item) => sum + item.discount, 0);
    this.total = this.subtotal + this.taxAmount - this.discountAmount;
  }
  next();
});

// Pre-save middleware to set completedAt
OrderSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Virtual for payment total
OrderSchema.virtual('paymentTotal').get(function() {
  if (!this.payments || !Array.isArray(this.payments)) return 0;
  return this.payments.reduce((sum: number, payment: IPaymentMethod) => sum + payment.amount, 0);
});

// Virtual for is fully paid
OrderSchema.virtual('isFullyPaid').get(function() {
  if (!this.payments || !Array.isArray(this.payments)) return false;
  const paymentTotal = this.payments.reduce((sum: number, payment: IPaymentMethod) => sum + payment.amount, 0);
  return paymentTotal >= this.total;
});

// Virtual for remaining balance
OrderSchema.virtual('remainingBalance').get(function() {
  if (!this.payments || !Array.isArray(this.payments)) return this.total;
  const paymentTotal = this.payments.reduce((sum: number, payment: IPaymentMethod) => sum + payment.amount, 0);
  return Math.max(0, this.total - paymentTotal);
});

// Static method to get daily stats
OrderSchema.statics['getDailyStats'] = function(storeId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalTax: { $sum: '$taxAmount' },
        totalDiscount: { $sum: '$discountAmount' },
        averageOrderValue: { $avg: '$total' }
      }
    }
  ]);
};

// Static method to get payment method breakdown
OrderSchema.statics['getPaymentBreakdown'] = function(storeId: string, startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    { $unwind: '$payments' },
    {
      $group: {
        _id: '$payments.method',
        totalAmount: { $sum: '$payments.amount' },
        transactionCount: { $sum: 1 }
      }
    }
  ]);
};

export default mongoose.model<IOrder>('Order', OrderSchema);
