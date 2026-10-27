export function generateRecommendations(profile = {}, metrics = {}) {
  const recommendations = [];
  const activityLevel = profile.activityLevel;
  const goal = profile.goal || profile.wellnessGoals?.[0] || 'general wellness';
  const diet = profile.diet || profile.dietaryPreferences?.[0] || 'balanced';
  const latestLog = metrics.latestLog || {};
  const sleepHours = latestLog.sleep ?? profile.sleepHours;
  const goals = [...(profile.goals || []), ...(profile.wellnessGoals || []), goal].map((item) => String(item).toLowerCase());

  if (activityLevel === 'beginner' || activityLevel === 'low') {
    recommendations.push({
      type: 'activity',
      title: 'Build movement gradually',
      message: 'Try a comfortable 10–20 minute walk or gentle movement session, then increase duration at a pace that feels sustainable.',
      reason: `Your selected activity level is ${activityLevel}.`,
      relevance: `Activity level: ${activityLevel}`,
      priority: 'high',
    });
  }

  if (goals.some((item) => /fitness|movement|active|strength/.test(item))) {
    recommendations.push({
      type: 'activity',
      title: 'Keep a steady activity routine',
      message: 'Plan a moderate activity session that fits your schedule and include easier days for rest.',
      reason: 'You selected a fitness or movement goal.',
      relevance: `Wellness goal: ${goal}`,
      priority: 'medium',
    });
  }

  if (diet === 'vegetarian' || diet === 'vegan' || (profile.dietaryPreferences || []).some((item) => ['vegetarian', 'vegan'].includes(String(item).toLowerCase()))) {
    recommendations.push({
      type: 'nutrition',
      title: 'Include varied plant proteins',
      message: 'Consider pairing beans, lentils, tofu, nuts, or dairy with vegetables and whole grains across meals.',
      reason: `This suggestion reflects your ${diet} dietary preference.`,
      relevance: `Dietary preference: ${diet}`,
      priority: 'high',
    });
  }

  if (Number.isFinite(Number(sleepHours)) && Number(sleepHours) > 0 && Number(sleepHours) < 7) {
    recommendations.push({
      type: 'sleep',
      title: 'Create a consistent wind-down routine',
      message: 'Consider keeping a regular bedtime and choosing a calming, screen-light activity before sleep.',
      reason: `Your latest saved sleep entry is ${sleepHours} hours.`,
      relevance: 'Recent sleep log',
      priority: 'high',
    });
  }

  if (Number.isFinite(Number(latestLog.steps)) && Number(latestLog.steps) > 0 && Number(latestLog.steps) < 7000) {
    recommendations.push({
      type: 'activity',
      title: 'Add a short movement break',
      message: 'A brief walk or stretch break can help you build activity gradually during the day.',
      reason: `Your latest saved step count is ${latestLog.steps}, below the app's general 7,000-step reference.`,
      relevance: 'Recent activity log',
      priority: 'medium',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'lifestyle',
      title: 'Choose one small wellness habit',
      message: 'Pick a manageable habit that supports your routine, such as a regular water break or a short walk.',
      reason: 'There is not enough saved profile or activity data for a more specific suggestion yet.',
      relevance: 'General wellness',
      priority: 'low',
    });
  }

  return recommendations;
}
