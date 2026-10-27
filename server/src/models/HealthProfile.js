import mongoose from 'mongoose';

const healthProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ageRange: { type: String },
    height: { type: Number, min: 80, max: 250 },
    weight: { type: Number, min: 20, max: 350 },
    goals: [{ type: String }],
    dietaryPreferences: [{ type: String }],
    diet: { type: String, default: 'balanced' },
    goal: { type: String, default: 'general wellness' },
    activityLevel: { type: String, default: 'beginner' },
    sleepHours: { type: Number, min: 0, max: 24 },
    wellnessGoals: [{ type: String }],
    lifestyle: { type: String, default: 'balanced' },
  },
  { timestamps: true },
);

healthProfileSchema.index({ userId: 1 }, { unique: true });

export default mongoose.models.HealthProfile || mongoose.model('HealthProfile', healthProfileSchema, 'healthprofiles');
