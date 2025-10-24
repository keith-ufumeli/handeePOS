import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  _id: string;
  storeId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  storeId: {
    type: Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'Store ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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

// Compound index for unique category names per store
CategorySchema.index({ storeId: 1, name: 1 }, { unique: true });
CategorySchema.index({ storeId: 1, isActive: 1 });

// Pre-save middleware to ensure name uniqueness per store
CategorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    const CategoryModel = mongoose.model('Category');
    const existingCategory = await CategoryModel.findOne({
      storeId: this.storeId,
      name: this.name,
      _id: { $ne: this._id }
    });
    
    if (existingCategory) {
      const error = new Error('Category name already exists in this store');
      return next(error);
    }
  }
  next();
});

export default mongoose.model<ICategory>('Category', CategorySchema);
