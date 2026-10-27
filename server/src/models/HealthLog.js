import mongoose from 'mongoose';

const healthLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    steps: { type: Number, min: 0, max: 100000, default: null },
    sleep: { type: Number, min: 0, max: 24, default: null },
    hydration: { type: Number, min: 0, max: 20, default: null },
    activityType: { type: String, default: 'Other', maxlength: 60 },
    activityMinutes: { type: Number, min: 0, max: 1440, default: null },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

healthLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.models.HealthLog || mongoose.model('HealthLog', healthLogSchema, 'healthlogs');
