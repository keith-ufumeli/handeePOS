import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  barcode?: string;
  categoryId: mongoose.Types.ObjectId;
  price: number;
  cost: number;
  taxRate: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  images: string[];
  isActive: boolean;
  syncVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  storeId: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'Store ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true,
    uppercase: true,
    maxlength: [50, 'SKU cannot exceed 50 characters']
  },
  barcode: {
    type: String,
    trim: true,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
    maxlength: [50, 'Barcode cannot exceed 50 characters']
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  cost: {
    type: Number,
    required: [true, 'Cost is required'],
    min: [0, 'Cost cannot be negative']
  },
  taxRate: {
    type: Number,
    required: [true, 'Tax rate is required'],
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%'],
    default: 0
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative'],
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    required: [true, 'Low stock threshold is required'],
    min: [0, 'Low stock threshold cannot be negative'],
    default: 5
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true,
    maxlength: [20, 'Unit cannot exceed 20 characters'],
    default: 'pcs'
  },
  images: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  syncVersion: {
    type: Number,
    default: 1
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
ProductSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, barcode: 1 }, { sparse: true });
ProductSchema.index({ storeId: 1, categoryId: 1 });
ProductSchema.index({ storeId: 1, isActive: 1 });
ProductSchema.index({ storeId: 1, name: 'text', sku: 'text' }); // Text search index

// Pre-save middleware to increment sync version
ProductSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.syncVersion += 1;
  }
  next();
});

// Virtual for profit margin
ProductSchema.virtual('profitMargin').get(function() {
  if (this.cost === 0) return 0;
  return ((this.price - this.cost) / this.cost) * 100;
});

// Virtual for low stock status
ProductSchema.virtual('isLowStock').get(function() {
  return this.stockQuantity <= this.lowStockThreshold;
});

// Static method to find low stock products
ProductSchema.statics['findLowStock'] = function(storeId: string) {
  return this.find({
    storeId,
    isActive: true,
    $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
  });
};

// Static method to search products
ProductSchema.statics['searchProducts'] = function(storeId: string, searchTerm: string, categoryId?: string) {
  const query: any = {
    storeId,
    isActive: true
  };

  if (categoryId) {
    query.categoryId = categoryId;
  }

  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { sku: { $regex: searchTerm, $options: 'i' } },
      { barcode: searchTerm }
    ];
  }

  return this.find(query).populate('categoryId', 'name');
};

export default mongoose.model<IProduct>('Product', ProductSchema);
