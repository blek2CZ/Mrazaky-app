import { vi } from 'vitest';

export const getSyncCode = vi.fn(() => null);
export const saveSyncCode = vi.fn();
export const clearSyncCode = vi.fn();
export const generateSyncCode = vi.fn(() => 'TEST123');
export const isFirebaseConfigured = vi.fn(() => false); // Vypnuto pro testy
export const syncDataToFirebase = vi.fn(async () => ({ success: true, serverTimestamp: Date.now() }));
export const syncDataToFirebaseForce = vi.fn(async () => ({ success: true, serverTimestamp: Date.now() }));
export const fetchDataFromFirebase = vi.fn(async () => ({ success: false }));
export const invalidateSyncCode = vi.fn(async () => {});
export const getAdminPasswordHash = vi.fn(async () => null);

vi.mock('../firebaseSync', () => ({
  getSyncCode,
  saveSyncCode,
  clearSyncCode,
  generateSyncCode,
  isFirebaseConfigured,
  syncDataToFirebase,
  syncDataToFirebaseForce,
  fetchDataFromFirebase,
  invalidateSyncCode,
  getAdminPasswordHash,
}));
