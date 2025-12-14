import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

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
    expect(screen.getByTitle(/Export/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Import/i)).toBeInTheDocument();
  });
});
