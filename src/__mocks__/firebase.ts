import { vi } from 'vitest';

// Mock Firebase
export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
};

export const mockFirebase = {
  initializeApp: vi.fn(),
  getFirestore: vi.fn(() => mockFirestore),
};

vi.mock('firebase/app', () => ({
  initializeApp: mockFirebase.initializeApp,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: mockFirebase.getFirestore,
  doc: mockFirestore.doc,
  getDoc: mockFirestore.getDoc,
  setDoc: mockFirestore.setDoc,
  deleteDoc: mockFirestore.deleteDoc,
}));
