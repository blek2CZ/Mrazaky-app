import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DisconnectModal } from '../components/DisconnectModal';

describe('DisconnectModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with title and description', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    expect(screen.getByText(/Odpojit synchronizaci/i)).toBeInTheDocument();
    expect(screen.getByText(/Zadejte admin heslo pro potvrzení odpojení/i)).toBeInTheDocument();
    expect(screen.getByText(/Po odpojení můžete vytvořit nový sync kód/i)).toBeInTheDocument();
  });

  it('should render password input field', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should toggle password visibility', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const toggleButton = screen.getByTitle(/Zobrazit heslo/i);
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should disable confirm button when password is empty', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const confirmButton = screen.getByText('Odpojit');
    expect(confirmButton).toBeDisabled();
  });

  it('should call onConfirm with password when confirmed', async () => {
    mockOnConfirm.mockResolvedValue(true);
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const confirmButton = screen.getByText('Odpojit');
    
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith('admin123');
    });
  });

  it('should show error on incorrect password', async () => {
    mockOnConfirm.mockResolvedValue(false);
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const confirmButton = screen.getByText('Odpojit');
    
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(screen.getByText('Nesprávné admin heslo!')).toBeInTheDocument();
    });
  });

  it('should disable buttons while processing', async () => {
    let resolveConfirm: (value: boolean) => void;
    const confirmPromise = new Promise<boolean>((resolve) => {
      resolveConfirm = resolve;
    });
    mockOnConfirm.mockReturnValue(confirmPromise);
    
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const confirmButton = screen.getByText('Odpojit');
    const cancelButton = screen.getByText('Zrušit');
    
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(screen.getByText('Odpojuji...')).toBeInTheDocument();
    });
    
    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    
    resolveConfirm!(true);
  });

  it('should call onClose when clicking cancel button', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const cancelButton = screen.getByText('Zrušit');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when clicking overlay', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const overlay = screen.getByText(/Odpojit synchronizaci/i).closest('.sync-modal-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should not close when clicking modal content', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const modal = screen.getByText(/Odpojit synchronizaci/i).closest('.sync-modal');
    if (modal) {
      fireEvent.click(modal);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should enable confirm button when password is entered', () => {
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const confirmButton = screen.getByText('Odpojit');
    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    
    expect(confirmButton).toBeDisabled();
    
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    
    expect(confirmButton).not.toBeDisabled();
  });

  it('should submit on Enter key press', async () => {
    mockOnConfirm.mockResolvedValue(true);
    render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.keyDown(passwordInput, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith('admin123');
    });
  });

  it('should have CSS classes applied correctly', () => {
    const { container } = render(<DisconnectModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);
    
    expect(container.querySelector('.sync-modal-overlay')).toBeInTheDocument();
    expect(container.querySelector('.sync-modal')).toBeInTheDocument();
    expect(container.querySelector('.form-field')).toBeInTheDocument();
    expect(container.querySelector('.sync-modal-actions')).toBeInTheDocument();
  });
});
