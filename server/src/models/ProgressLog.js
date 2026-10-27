import mongoose from 'mongoose';

const progressLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    completion: { type: Number, default: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.models.ProgressLog || mongoose.model('ProgressLog', progressLogSchema, 'progresslogs');
