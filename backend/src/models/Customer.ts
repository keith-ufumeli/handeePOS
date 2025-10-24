import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  _id: string;
  storeId: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  totalSpent: number;
  totalOrders: number;
  lastVisit?: Date;
  notes?: string;
  loyaltyPoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>({
  storeId: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'Store ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    sparse: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number'],
    sparse: true
  },
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City name cannot exceed 50 characters']
    },
    country: {
      type: String,
      trim: true,
      maxlength: [50, 'Country name cannot exceed 50 characters']
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: [20, 'Postal code cannot exceed 20 characters']
    }
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: [0, 'Total spent cannot be negative']
  },
  totalOrders: {
    type: Number,
    default: 0,
    min: [0, 'Total orders cannot be negative']
  },
  lastVisit: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: [0, 'Loyalty points cannot be negative']
  },
  tier: {
    type: String,
    enum: {
      values: ['bronze', 'silver', 'gold', 'platinum'],
      message: 'Tier must be one of: bronze, silver, gold, platinum'
    },
    default: 'bronze'
  },
  isActive: {
    type: Boolean,
    default: true
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
CustomerSchema.index({ storeId: 1, email: 1 }, { sparse: true });
CustomerSchema.index({ storeId: 1, phoneNumber: 1 }, { sparse: true });
CustomerSchema.index({ storeId: 1, name: 'text' }); // Text search index
CustomerSchema.index({ storeId: 1, isActive: 1 });
CustomerSchema.index({ storeId: 1, tier: 1 });

// Pre-save middleware to update tier based on total spent
CustomerSchema.pre('save', function(next) {
  if (this.isModified('totalSpent')) {
    if (this.totalSpent >= 10000) {
      this.tier = 'platinum';
    } else if (this.totalSpent >= 5000) {
      this.tier = 'gold';
    } else if (this.totalSpent >= 1000) {
      this.tier = 'silver';
    } else {
      this.tier = 'bronze';
    }
  }
  next();
});

// Virtual for average order value
CustomerSchema.virtual('averageOrderValue').get(function() {
  return this.totalOrders > 0 ? this.totalSpent / this.totalOrders : 0;
});

// Static method to search customers
CustomerSchema.statics.searchCustomers = function(storeId: string, searchTerm: string) {
  const query: any = {
    storeId,
    isActive: true
  };

  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  return this.find(query).sort({ name: 1 });
};

// Static method to get customer stats
CustomerSchema.statics.getCustomerStats = function(storeId: string) {
  return this.aggregate([
    { $match: { storeId: new mongoose.Types.ObjectId(storeId), isActive: true } },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        totalSpent: { $sum: '$totalSpent' },
        averageSpent: { $avg: '$totalSpent' },
        totalOrders: { $sum: '$totalOrders' },
        averageOrders: { $avg: '$totalOrders' },
        totalLoyaltyPoints: { $sum: '$loyaltyPoints' }
      }
    }
  ]);
};

// Static method to get tier breakdown
CustomerSchema.statics.getTierBreakdown = function(storeId: string) {
  return this.aggregate([
    { $match: { storeId: new mongoose.Types.ObjectId(storeId), isActive: true } },
    {
      $group: {
        _id: '$tier',
        count: { $sum: 1 },
        totalSpent: { $sum: '$totalSpent' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
