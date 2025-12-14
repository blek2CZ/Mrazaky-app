import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationSnackbar } from '../components/NotificationSnackbar';

describe('NotificationSnackbar', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error notifications', () => {
    it('should render error notification with message', () => {
      render(
        <NotificationSnackbar 
          type="error" 
          message="Test error message" 
          onClose={mockOnClose} 
        />
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('should have error CSS class', () => {
      const { container } = render(
        <NotificationSnackbar 
          type="error" 
          message="Error" 
          onClose={mockOnClose} 
        />
      );

      const notification = container.querySelector('.notification-snackbar');
      expect(notification).toHaveClass('error');
    });

    it('should have assertive aria-live for errors', () => {
      const { container } = render(
        <NotificationSnackbar 
          type="error" 
          message="Error" 
          onClose={mockOnClose} 
        />
      );

      const notification = container.querySelector('.notification-snackbar');
      expect(notification).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Success notifications', () => {
    it('should render success notification with message', () => {
      render(
        <NotificationSnackbar 
          type="success" 
          message="Test success message" 
          onClose={mockOnClose} 
        />
      );

      expect(screen.getByText('Test success message')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('should have success CSS class', () => {
      const { container } = render(
        <NotificationSnackbar 
          type="success" 
          message="Success" 
          onClose={mockOnClose} 
        />
      );

      const notification = container.querySelector('.notification-snackbar');
      expect(notification).toHaveClass('success');
    });

    it('should have polite aria-live for success', () => {
      const { container } = render(
        <NotificationSnackbar 
          type="success" 
          message="Success" 
          onClose={mockOnClose} 
        />
      );

      const notification = container.querySelector('.notification-snackbar');
      expect(notification).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Interaction', () => {
    it('should call onClose when clicking close button', () => {
      render(
        <NotificationSnackbar 
          type="success" 
          message="Test" 
          onClose={mockOnClose} 
        />
      );

      const closeButton = screen.getByLabelText('Zavřít notifikaci');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should render close button with X symbol', () => {
      render(
        <NotificationSnackbar 
          type="error" 
          message="Test" 
          onClose={mockOnClose} 
        />
      );

      expect(screen.getByText('×')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert"', () => {
      const { container } = render(
        <NotificationSnackbar 
          type="error" 
          message="Test" 
          onClose={mockOnClose} 
        />
      );

      const notification = container.querySelector('.notification-snackbar');
      expect(notification).toHaveAttribute('role', 'alert');
    });

    it('should have aria-label on close button', () => {
      render(
        <NotificationSnackbar 
          type="success" 
          message="Test" 
          onClose={mockOnClose} 
        />
      );

      const closeButton = screen.getByLabelText('Zavřít notifikaci');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Content rendering', () => {
    it('should render long messages correctly', () => {
      const longMessage = 'This is a very long error message that should still be displayed correctly within the notification component even though it spans multiple lines.';
      
      render(
        <NotificationSnackbar 
          type="error" 
          message={longMessage} 
          onClose={mockOnClose} 
        />
      );

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should render messages with emojis', () => {
      render(
        <NotificationSnackbar 
          type="success" 
          message="✅ Data byla úspěšně uložena 🎉" 
          onClose={mockOnClose} 
        />
      );

      expect(screen.getByText('✅ Data byla úspěšně uložena 🎉')).toBeInTheDocument();
    });

    it('should render messages with special characters', () => {
      render(
        <NotificationSnackbar 
          type="error" 
          message="Chyba: <script>alert('test')</script>" 
          onClose={mockOnClose} 
        />
      );

      expect(screen.getByText("Chyba: <script>alert('test')</script>")).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('should have all required CSS classes', () => {
      const { container } = render(
        <NotificationSnackbar 
          type="error" 
          message="Test" 
          onClose={mockOnClose} 
        />
      );

      expect(container.querySelector('.notification-snackbar')).toBeInTheDocument();
      expect(container.querySelector('.notification-icon')).toBeInTheDocument();
      expect(container.querySelector('.notification-message')).toBeInTheDocument();
      expect(container.querySelector('.notification-close')).toBeInTheDocument();
    });
  });
});
