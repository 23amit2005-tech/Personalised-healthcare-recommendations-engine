export const store = {
  users: [],
  profiles: [],
  healthLogs: [],
  recommendations: [],
  progressLogs: [],
  notifications: [],
};

export function createUserRecord(userData) {
  const user = {
    id: cryptoId(),
    ...userData,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.users.push(user);
  return user;
}

export function findUserByEmail(email) {
  return store.users.find((user) => user.email === email);
}

export function findUserById(id) {
  return store.users.find((user) => user.id === id || user._id?.toString() === id);
}

export function upsertProfile(userId, profileData) {
  const existingIndex = store.profiles.findIndex((profile) => profile.userId === userId);

  const profile = {
    id: existingIndex >= 0 ? store.profiles[existingIndex].id : cryptoId(),
    userId,
    ...profileData,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    store.profiles[existingIndex] = profile;
    return profile;
  }

  store.profiles.push({ ...profile, createdAt: new Date().toISOString() });
  return profile;
}

export function getProfileByUserId(userId) {
  return store.profiles.find((profile) => profile.userId === userId);
}

export function createHealthLog(userId, payload) {
  const date = new Date(payload.date);
  date.setUTCHours(0, 0, 0, 0);
  const existing = store.healthLogs.find((log) => log.userId === userId && new Date(log.date).getTime() === date.getTime());

  if (existing) {
    Object.assign(existing, payload, { date: date.toISOString(), updatedAt: new Date().toISOString() });
    return existing;
  }

  const log = {
    id: cryptoId(),
    userId,
    ...payload,
    date: date.toISOString(),
    createdAt: new Date().toISOString(),
  };
  store.healthLogs.push(log);
  return log;
}

export function getHealthLogsByUserId(userId) {
  return store.healthLogs
    .filter((log) => log.userId === userId)
    .sort((left, right) => new Date(left.date) - new Date(right.date));
}

export function updateHealthLog(userId, logId, payload) {
  const log = store.healthLogs.find((item) => item.userId === userId && item.id === logId);
  if (!log) return null;

  const date = new Date(payload.date);
  date.setUTCHours(0, 0, 0, 0);
  const duplicateDate = store.healthLogs.some((item) => item.userId === userId && item.id !== logId && new Date(item.date).getTime() === date.getTime());
  if (duplicateDate) return false;

  Object.assign(log, payload, { date: date.toISOString(), updatedAt: new Date().toISOString() });
  return log;
}

export function deleteHealthLog(userId, logId) {
  const index = store.healthLogs.findIndex((item) => item.userId === userId && item.id === logId);
  if (index < 0) return false;

  store.healthLogs.splice(index, 1);
  return true;
}

export function createRecommendation(userId, payload) {
  const recommendation = {
    id: cryptoId(),
    userId,
    ...payload,
    createdAt: new Date().toISOString(),
  };
  store.recommendations.push(recommendation);
  return recommendation;
}

export function getRecommendationsByUserId(userId, { includeDismissed = false } = {}) {
  return store.recommendations
    .filter((item) => item.userId === userId && (includeDismissed || item.status !== 'dismissed'))
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

export function updateRecommendation(userId, recommendationId, payload) {
  const recommendation = store.recommendations.find((item) => item.userId === userId && item.id === recommendationId);
  if (!recommendation) return null;

  Object.assign(recommendation, payload);
  return recommendation;
}

export function createNotification(userId, payload) {
  const notification = { id: cryptoId(), userId, ...payload, readAt: null, createdAt: new Date().toISOString() };
  store.notifications.push(notification);
  return notification;
}

export function createProgressLog(userId, payload) {
  const log = {
    id: cryptoId(),
    userId,
    ...payload,
    createdAt: new Date().toISOString(),
  };
  store.progressLogs.push(log);
  return log;
}

export function getProgressLogsByUserId(userId) {
  return store.progressLogs.filter((log) => log.userId === userId);
}

function cryptoId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
