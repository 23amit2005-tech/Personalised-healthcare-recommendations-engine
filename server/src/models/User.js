import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'user' },
    tokenVersion: { type: Number, default: 0 },
    notificationsEnabled: { type: Boolean, default: true },
    notificationPreferences: {
      email: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema, 'users');
