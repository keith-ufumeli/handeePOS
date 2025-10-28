import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phoneNumber?: string;
  role: 'admin' | 'manager' | 'cashier' | 'inventory';
  storeId: mongoose.Types.ObjectId;
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  resetToken?: string | undefined;
  resetTokenExpiry?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['admin', 'manager', 'cashier', 'inventory'],
      message: 'Role must be one of: admin, manager, cashier, inventory'
    }
  },
  storeId: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'Store ID is required']
  },
  permissions: [{
    type: String,
    enum: [
      'sales', 'products', 'inventory', 'customers', 'reports', 
      'staff', 'settings', 'multi_store'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  resetToken: {
    type: String,
    select: false,
    sparse: true
  },
  resetTokenExpiry: {
    type: Date,
    select: false,
    sparse: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(_doc, ret) {
      const { passwordHash, __v, ...cleanRet } = ret;
      return cleanRet;
    }
  }
});

// Indexes for performance
UserSchema.index({ storeId: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

// Pre-save middleware to set permissions based on role
UserSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('role')) {
    switch (this.role) {
      case 'admin':
        this.permissions = ['sales', 'products', 'inventory', 'customers', 'reports', 'staff', 'settings', 'multi_store'];
        break;
      case 'manager':
        this.permissions = ['sales', 'products', 'inventory', 'customers', 'reports', 'staff'];
        break;
      case 'cashier':
        this.permissions = ['sales', 'customers'];
        break;
      case 'inventory':
        this.permissions = ['products', 'inventory'];
        break;
      default:
        this.permissions = [];
    }
  }
  next();
});

export default mongoose.model<IUser>('User', UserSchema);
