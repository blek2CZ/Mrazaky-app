import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock firebaseSync aby testy nevisely
vi.mock('../firebaseSync', () => ({
  getSyncCode: () => null,
  saveSyncCode: vi.fn(),
  clearSyncCode: vi.fn(),
  isFirebaseConfigured: () => false,
  syncDataToFirebase: vi.fn(),
  syncDataToFirebaseForce: vi.fn(),
  fetchDataFromFirebase: vi.fn(),
  invalidateSyncCode: vi.fn(),
  getAdminPasswordHash: vi.fn(),
}));

describe('App - Smoke Test', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Evidence mrazáků/i)).toBeInTheDocument();
  });

  it('should render all three freezers', () => {
    render(<App />);
    expect(screen.getByText(/Malý mrazák/i)).toBeInTheDocument();
    expect(screen.getByText(/Velký mrazák/i)).toBeInTheDocument();
    expect(screen.getByText(/Malý mama/i)).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(<App />);
    expect(screen.getByTitle(/Stáhnout zálohu/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Nahrát data/i)).toBeInTheDocument();
  });
});
