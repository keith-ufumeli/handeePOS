import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  deviceInfo?: {
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    appVersion?: string;
  };
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  replacedByToken?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  isValid(): boolean;
  revoke(reason?: string, replacementToken?: string): Promise<void>;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceInfo: {
      deviceId: String,
      deviceName: String,
      platform: String,
      appVersion: String,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: Date,
    revokedReason: String,
    replacedByToken: String,
    lastUsedAt: Date,
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Index for cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient lookup of active tokens
refreshTokenSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

// Method to check if token is valid
refreshTokenSchema.methods['isValid'] = function (): boolean {
  const doc = this as IRefreshToken;
  return !doc.isRevoked && doc.expiresAt > new Date();
};

// Method to revoke token
refreshTokenSchema.methods['revoke'] = async function (
  reason?: string,
  replacementToken?: string
): Promise<void> {
  const doc = this as IRefreshToken;
  doc.isRevoked = true;
  doc.revokedAt = new Date();
  if (reason) doc.revokedReason = reason;
  if (replacementToken) doc.replacedByToken = replacementToken;
  await doc.save();
};

// Static method to clean up expired tokens
refreshTokenSchema.statics['cleanupExpiredTokens'] =
  async function (): Promise<number> {
    const result = await this.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        {
          isRevoked: true,
          revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        }, // Revoked > 30 days ago
      ],
    });
    return result.deletedCount;
  };

// Static method to revoke all tokens for a user
refreshTokenSchema.statics['revokeAllForUser'] = async function (
  userId: mongoose.Types.ObjectId,
  reason: string = 'User logout'
): Promise<number> {
  const result = await this.updateMany(
    { userId, isRevoked: false },
    {
      $set: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    }
  );
  return result.modifiedCount;
};

// Interface for static methods
interface IRefreshTokenModel extends mongoose.Model<IRefreshToken> {
  cleanupExpiredTokens(): Promise<number>;
  revokeAllForUser(
    userId: mongoose.Types.ObjectId,
    reason?: string
  ): Promise<number>;
}

const RefreshToken = mongoose.model<IRefreshToken, IRefreshTokenModel>(
  'RefreshToken',
  refreshTokenSchema
);

export default RefreshToken;
