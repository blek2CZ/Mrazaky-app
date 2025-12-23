import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock firebaseSync
vi.mock('../firebaseSync', () => ({
  getSyncCode: () => null,
  saveSyncCode: vi.fn(),
  clearSyncCode: vi.fn(),
  isFirebaseConfigured: () => false,
  syncDataToFirebase: vi.fn().mockResolvedValue({ success: true, serverTimestamp: Date.now() }),
  syncDataToFirebaseForce: vi.fn(),
  fetchDataFromFirebase: vi.fn(),
  invalidateSyncCode: vi.fn(),
  getAdminPasswordHash: vi.fn(),
}));

describe('Detekce změn - Pokročilé scénáře', () => {
  beforeEach(() => {
    localStorage.clear();
    // Nastavit známý počáteční stav
    const initialData = {
      freezerData: {
        small: { 
          1: [{ id: '1', name: 'Testovací položka', quantity: 5 }],
          2: [], 
          3: [] 
        },
        large: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
        smallMama: { 1: [] }
      },
      templates: [{ id: '1', name: 'Testovací položka' }]
    };
    localStorage.setItem('mrazaky-data', JSON.stringify(initialData.freezerData));
    localStorage.setItem('mrazaky-templates', JSON.stringify(initialData.templates));
    localStorage.setItem('mrazaky-lastSyncedData', JSON.stringify(initialData));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by detekovat změnu při zvýšení množství', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Najít položku a zvýšit množství
    await waitFor(() => {
      expect(screen.getByText(/Testovací položka/i)).toBeInTheDocument();
    });

    const increaseButtons = screen.getAllByText('+');
    const itemIncreaseButton = increaseButtons.find(btn => 
      btn.parentElement?.textContent?.includes('Testovací položka')
    );

    if (itemIncreaseButton) {
      await user.click(itemIncreaseButton);

      // Ověřit detekci změny
      await waitFor(() => {
        const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
        expect(sendButton).toBeInTheDocument();
      }, { timeout: 3000 });
    }
  });

  it('měla by detekovat návrat na původní hodnotu jako "bez změn"', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Počkat na načtení
    await waitFor(() => {
      expect(screen.getByText(/Testovací položka/i)).toBeInTheDocument();
    });

    // Ověřit, že původně nejsou neuložené změny
    await waitFor(() => {
      const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
      expect(sendButton).not.toBeInTheDocument();
    });

    // Zvýšit množství
    const increaseButtons = screen.getAllByText('+');
    const itemIncreaseButton = increaseButtons.find(btn => 
      btn.parentElement?.textContent?.includes('Testovací položka')
    );

    if (itemIncreaseButton) {
      await user.click(itemIncreaseButton); // 5 -> 6

      // Ověřit detekci změny
      await waitFor(() => {
        const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
        expect(sendButton).toBeInTheDocument();
      });

      // Snížit zpět na původní hodnotu
      const decreaseButtons = screen.getAllByText('−');
      const itemDecreaseButton = decreaseButtons.find(btn => 
        btn.parentElement?.textContent?.includes('Testovací položka')
      );

      if (itemDecreaseButton) {
        await user.click(itemDecreaseButton); // 6 -> 5

        // Ověřit, že změny už nejsou detekovány
        await waitFor(() => {
          const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
          expect(sendButton).not.toBeInTheDocument();
        }, { timeout: 3000 });
      }
    }
  });

  it('měla by detekovat více po sobě jdoucích změn jako jednu změnu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Testovací položka/i)).toBeInTheDocument();
    });

    const increaseButtons = screen.getAllByText('+');
    const itemIncreaseButton = increaseButtons.find(btn => 
      btn.parentElement?.textContent?.includes('Testovací položka')
    );

    if (itemIncreaseButton) {
      // Několik změn za sebou
      await user.click(itemIncreaseButton); // 5 -> 6
      await user.click(itemIncreaseButton); // 6 -> 7
      await user.click(itemIncreaseButton); // 7 -> 8

      // Stále by mělo být detekováno jako změna
      await waitFor(() => {
        const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
        expect(sendButton).toBeInTheDocument();
      });
    }
  });

  it('neměla by detekovat změnu po zahození změn', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Testovací položka/i)).toBeInTheDocument();
    });

    // Udělat změnu
    const increaseButtons = screen.getAllByText('+');
    const itemIncreaseButton = increaseButtons.find(btn => 
      btn.parentElement?.textContent?.includes('Testovací položka')
    );

    if (itemIncreaseButton) {
      await user.click(itemIncreaseButton);

      // Ověřit detekci
      await waitFor(() => {
        const sendButton = screen.getByText(/Odeslat změny do cloudu/i);
        expect(sendButton).toBeInTheDocument();
      });

      // Kliknout na odeslání změn
      const sendButton = screen.getByText(/Odeslat změny do cloudu/i);
      await user.click(sendButton);

      // Počkat na toast a zahodit změny
      await waitFor(() => {
        expect(screen.getByText('Zahodit změny')).toBeInTheDocument();
      });

      const discardButton = screen.getByText('Zahodit změny');
      await user.click(discardButton);

      // Ověřit, že změny už nejsou detekovány
      await waitFor(() => {
        const sendButtonAfter = screen.queryByText(/Odeslat změny do cloudu/i);
        expect(sendButtonAfter).not.toBeInTheDocument();
      });

      // Ověřit, že hodnota se vrátila na původní
      await waitFor(() => {
        expect(screen.getByText(/5 ks/i)).toBeInTheDocument();
      });
    }
  });
});

describe('Persistence po reloadu', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by zachovat lastSyncedData po reloadu', async () => {
    // Nastavit známý stav
    const syncedData = {
      freezerData: {
        small: { 
          1: [{ id: '1', name: 'Synced položka', quantity: 3 }],
          2: [], 
          3: [] 
        },
        large: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
        smallMama: { 1: [] }
      },
      templates: [{ id: '1', name: 'Synced položka' }]
    };

    const currentData = {
      freezerData: {
        small: { 
          1: [{ id: '1', name: 'Synced položka', quantity: 5 }], // Změněné množství
          2: [], 
          3: [] 
        },
        large: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
        smallMama: { 1: [] }
      },
      templates: [{ id: '1', name: 'Synced položka' }]
    };

    localStorage.setItem('mrazaky-lastSyncedData', JSON.stringify(syncedData));
    localStorage.setItem('mrazaky-data', JSON.stringify(currentData.freezerData));
    localStorage.setItem('mrazaky-templates', JSON.stringify(currentData.templates));

    // Render aplikace (simulace reloadu)
    const { unmount } = render(<App />);

    // Ověřit, že jsou detekovány změny
    await waitFor(() => {
      const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
      expect(sendButton).toBeInTheDocument();
    }, { timeout: 3000 });

    unmount();

    // Druhý render (další reload)
    render(<App />);

    // Změny by stále měly být detekovány
    await waitFor(() => {
      const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
      expect(sendButton).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('Editace šablony - Propagace změn', () => {
  beforeEach(() => {
    localStorage.clear();
    // Nastavit stav s položkou v mrazáku
    const initialData = {
      freezerData: {
        small: { 
          1: [
            { id: '1', name: 'Kuřecí prsa', quantity: 3 },
            { id: '2', name: 'Kuřecí prsa', quantity: 5 }
          ],
          2: [{ id: '3', name: 'Kuřecí prsa', quantity: 2 }], 
          3: [] 
        },
        large: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
        smallMama: { 1: [] }
      },
      templates: [
        { id: '1', name: 'Kuřecí prsa' },
        { id: '2', name: 'Hovězí maso' }
      ]
    };
    localStorage.setItem('mrazaky-data', JSON.stringify(initialData.freezerData));
    localStorage.setItem('mrazaky-templates', JSON.stringify(initialData.templates));
    localStorage.setItem('mrazaky-lastSyncedData', JSON.stringify(initialData));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by aktualizovat všechny položky při editaci šablony', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Otevřít správu položek
    const templateHeader = screen.getByText('Správa položek');
    await user.click(templateHeader);

    // Najít šablonu "Kuřecí prsa" a editovat ji
    await waitFor(() => {
      expect(screen.getByText('Kuřecí prsa')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Editovat');
    const kureciEditButton = editButtons.find(btn => 
      btn.parentElement?.textContent?.includes('Kuřecí prsa')
    );

    if (kureciEditButton) {
      await user.click(kureciEditButton);

      const editInput = screen.getByDisplayValue('Kuřecí prsa');
      await user.clear(editInput);
      await user.type(editInput, 'Kuřecí maso nové');

      const saveButton = screen.getByTitle('Uložit');
      await user.click(saveButton);

      // Ověřit, že se název změnil ve všech položkách
      await waitFor(() => {
        const updatedItems = screen.getAllByText(/Kuřecí maso nové/i);
        // Mělo by být: 1x v šablonách + 3x v šuplících
        expect(updatedItems.length).toBeGreaterThanOrEqual(4);
      });
    }
  });

  it('měla by označit šablonu jako použitou po propagaci', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Otevřít správu položek
    const templateHeader = screen.getByText('Správa položek');
    await user.click(templateHeader);

    await waitFor(() => {
      expect(screen.getByText('Kuřecí prsa')).toBeInTheDocument();
    });

    // Šablona by měla být označena jako použitá (má třídu template-used)
    const templateItem = screen.getByText('Kuřecí prsa').closest('.template-item');
    expect(templateItem).toHaveClass('template-used');
  });
});
