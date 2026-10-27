import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['nutrition', 'activity', 'sleep', 'lifestyle'] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: { type: String, default: 'medium' },
    reason: { type: String, required: true },
    relevance: { type: String, default: '' },
    status: { type: String, enum: ['active', 'dismissed'], default: 'active' },
    feedback: { type: String, enum: ['helpful', 'not-helpful', null], default: null },
  },
  { timestamps: true },
);

recommendationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Recommendation || mongoose.model('Recommendation', recommendationSchema, 'recommendations');
