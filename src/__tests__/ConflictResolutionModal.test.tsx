import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConflictResolutionModal } from '../components/ConflictResolutionModal';
import * as firebaseSync from '../firebaseSync';
import * as adminAuth from '../adminAuth';

vi.mock('../firebaseSync', () => ({
  getSyncCode: vi.fn(),
  getAdminPasswordHash: vi.fn(),
  saveSyncCode: vi.fn(),
  clearSyncCode: vi.fn(),
  syncDataToFirebase: vi.fn(),
  syncDataToFirebaseForce: vi.fn(),
  fetchDataFromFirebase: vi.fn(),
  isFirebaseConfigured: vi.fn(),
  invalidateSyncCode: vi.fn()
}));

vi.mock('../adminAuth', () => ({
  verifyPasswordHash: vi.fn()
}));

describe('ConflictResolutionModal', () => {
  const mockLocalData = {
    freezerData: {
      small: { '1': [], '2': [{ id: '1', name: 'Item 1', quantity: 1, template: '' }] },
      large: { '1': [], '2': [] },
      smallMama: { '1': [], '2': [] },
      cellar: { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [] }
    },
    templates: [{ id: 't1', name: 'Template 1', emoji: '🍕' }],
    lastModified: 1700000000000
  };

  const mockServerData = {
    freezerData: {
      small: { '1': [{ id: '2', name: 'Item 2', quantity: 2, template: '' }], '2': [] },
      large: { '1': [], '2': [] },
      smallMama: { '1': [], '2': [] },
      cellar: { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [] }
    },
    templates: [{ id: 't1', name: 'Template 1', emoji: '🍕' }, { id: 't2', name: 'Template 2', emoji: '🍔' }],
    lastModified: 1700001000000
  };

  const mockOnUseLocal = vi.fn();
  const mockOnUseServer = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render password verification screen initially', () => {
    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Konflikt verzí dat/i)).toBeInTheDocument();
    expect(screen.getByText(/Někdo jiný upravil data v cloudu/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Zadejte heslo')).toBeInTheDocument();
  });

  it('should toggle password visibility', () => {
    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const toggleButton = screen.getByTitle(/Zobrazit heslo/i);

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should show error when verifying with empty password', async () => {
    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    expect(verifyButton).toBeDisabled();

    // Enter password to enable button
    fireEvent.change(passwordInput, { target: { value: 'admin' } });
    expect(verifyButton).not.toBeDisabled();

    // Clear password
    fireEvent.change(passwordInput, { target: { value: '' } });
    expect(verifyButton).toBeDisabled();
  });

  it('should show error when sync code is not available', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue(null);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Synchronizační kód není k dispozici')).toBeInTheDocument();
    });
  });

  it('should show error when admin password is not set', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue(null);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Admin heslo není nastaveno')).toBeInTheDocument();
    });
  });

  it('should show error on incorrect password', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue('hashedPassword');
    vi.spyOn(adminAuth, 'verifyPasswordHash').mockResolvedValue(false);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Nesprávné admin heslo!')).toBeInTheDocument();
    });
  });

  it('should show data comparison screen after successful password verification', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue('hashedPassword');
    vi.spyOn(adminAuth, 'verifyPasswordHash').mockResolvedValue(true);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText(/Vyberte, kterou verzi dat chcete použít/i)).toBeInTheDocument();
      expect(screen.getByText(/Moje data \(lokální\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Data z cloudu/i).length).toBeGreaterThan(0);
    });
  });

  it('should display correct item and template counts', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue('hashedPassword');
    vi.spyOn(adminAuth, 'verifyPasswordHash').mockResolvedValue(true);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText(/Vyberte, kterou verzi dat chcete použít/i)).toBeInTheDocument();
    });

    // Local data: 1 item, 1 template
    const localSection = screen.getByText(/Moje data \(lokální\)/i).closest('div');
    expect(localSection).toHaveTextContent('Položek: 1');
    expect(localSection).toHaveTextContent('Šablon: 1');

    // Server data: 1 item, 2 templates - get the heading, not the button
    const serverHeading = screen.getByRole('heading', { name: /Data z cloudu/i });
    const serverSection = serverHeading.closest('div');
    expect(serverSection).toHaveTextContent('Položek: 1');
    expect(serverSection).toHaveTextContent('Šablon: 2');
  });

  it('should call onUseLocal when clicking local data button', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue('hashedPassword');
    vi.spyOn(adminAuth, 'verifyPasswordHash').mockResolvedValue(true);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      const useLocalButton = screen.getByText(/Použít moje data/i);
      fireEvent.click(useLocalButton);
    });

    expect(mockOnUseLocal).toHaveBeenCalledTimes(1);
  });

  it('should call onUseServer when clicking server data button', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue('hashedPassword');
    vi.spyOn(adminAuth, 'verifyPasswordHash').mockResolvedValue(true);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      const useServerButton = screen.getByText(/Použít data z cloudu/i);
      fireEvent.click(useServerButton);
    });

    expect(mockOnUseServer).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when clicking cancel button', () => {
    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Zrušit');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when clicking overlay', () => {
    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const overlay = screen.getByText(/Konflikt verzí dat/i).closest('.sync-modal-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    }
  });

  it('should not call onCancel when clicking modal content', () => {
    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const modal = screen.getByText(/Konflikt verzí dat/i).closest('.sync-modal');
    if (modal) {
      fireEvent.click(modal);
      expect(mockOnCancel).not.toHaveBeenCalled();
    }
  });

  it('should submit on Enter key press in password field', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue('hashedPassword');
    vi.spyOn(adminAuth, 'verifyPasswordHash').mockResolvedValue(true);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.keyDown(passwordInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Vyberte, kterou verzi dat chcete použít/i)).toBeInTheDocument();
    });
  });

  it('should display warning about overwriting data', async () => {
    vi.spyOn(firebaseSync, 'getSyncCode').mockReturnValue('TEST123');
    vi.spyOn(firebaseSync, 'getAdminPasswordHash').mockResolvedValue('hashedPassword');
    vi.spyOn(adminAuth, 'verifyPasswordHash').mockResolvedValue(true);

    render(
      <ConflictResolutionModal
        localData={mockLocalData}
        serverData={mockServerData}
        onUseLocal={mockOnUseLocal}
        onUseServer={mockOnUseServer}
        onCancel={mockOnCancel}
      />
    );

    const passwordInput = screen.getByPlaceholderText('Zadejte heslo');
    const verifyButton = screen.getByText('Ověřit heslo');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText(/Při použití vlastních dat přepíšete data v cloudu/i)).toBeInTheDocument();
    });
  });
});
