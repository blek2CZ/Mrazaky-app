import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingOverlay from '../components/LoadingOverlay';

describe('LoadingOverlay', () => {
  it('should render with default messages', () => {
    render(<LoadingOverlay />);
    
    expect(screen.getByText(/Nahrávám data do cloudu/i)).toBeInTheDocument();
    expect(screen.getByText(/Prosím čekejte/i)).toBeInTheDocument();
    expect(screen.getByText(/⏳/)).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<LoadingOverlay message="Custom loading..." submessage="Please wait" />);
    
    expect(screen.getByText(/Custom loading/i)).toBeInTheDocument();
    expect(screen.getByText(/Please wait/i)).toBeInTheDocument();
  });

  it('should have correct CSS classes', () => {
    const { container } = render(<LoadingOverlay />);
    
    expect(container.querySelector('.loading-overlay')).toBeInTheDocument();
    expect(container.querySelector('.loading-content')).toBeInTheDocument();
    expect(container.querySelector('.loading-spinner')).toBeInTheDocument();
  });
});
