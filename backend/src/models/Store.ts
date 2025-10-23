import mongoose, { Document, Schema } from 'mongoose';

export interface IStore extends Document {
  _id: string;
  name: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  phoneNumber?: string;
  email?: string;
  taxId?: string;
  currency: string;
  timezone: string;
  logo?: string;
  receiptSettings: {
    header: string;
    footer: string;
    showLogo: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<IStore>({
  name: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true,
    maxlength: [100, 'Store name cannot exceed 100 characters']
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [50, 'City name cannot exceed 50 characters']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      maxlength: [50, 'Country name cannot exceed 50 characters']
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
      maxlength: [20, 'Postal code cannot exceed 20 characters']
    }
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  taxId: {
    type: String,
    trim: true,
    maxlength: [50, 'Tax ID cannot exceed 50 characters']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD',
    enum: {
      values: ['USD', 'EUR', 'GBP', 'ZAR', 'KES', 'NGN', 'GHS', 'ZWL'],
      message: 'Currency must be one of: USD, EUR, GBP, ZAR, KES, NGN, GHS, ZWL'
    }
  },
  timezone: {
    type: String,
    required: [true, 'Timezone is required'],
    default: 'UTC',
    trim: true
  },
  logo: {
    type: String,
    trim: true
  },
  receiptSettings: {
    header: {
      type: String,
      default: 'Thank you for your business!',
      maxlength: [200, 'Header text cannot exceed 200 characters']
    },
    footer: {
      type: String,
      default: 'Visit us again soon!',
      maxlength: [200, 'Footer text cannot exceed 200 characters']
    },
    showLogo: {
      type: Boolean,
      default: false
    }
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

// Indexes for performance
StoreSchema.index({ name: 1 });
StoreSchema.index({ isActive: 1 });
StoreSchema.index({ 'address.city': 1 });

export default mongoose.model<IStore>('Store', StoreSchema);
