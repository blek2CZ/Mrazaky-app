import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { loadFreezerData, loadItemTemplates } from '../storage';

// Mock firebaseSync
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

describe('Správa položek - Základní chování', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by přidat novou šablonu', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Otevřít správu položek
    const templateHeader = screen.getByText('Správa položek');
    await user.click(templateHeader);

    // Kliknout na "Přidat novou položku"
    const addButton = screen.getByText('+ Přidat novou položku');
    await user.click(addButton);

    // Vyplnit název
    const input = screen.getByPlaceholderText('Název nové položky');
    await user.type(input, 'Nová testovací položka');

    // Kliknout na Přidat
    const submitButton = screen.getByRole('button', { name: /přidat/i });
    await user.click(submitButton);

    // Ověřit, že položka byla přidána
    await waitFor(() => {
      expect(screen.getByText('Nová testovací položka')).toBeInTheDocument();
    });
  });

  it('měla by editovat existující šablonu', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Otevřít správu položek
    const templateHeader = screen.getByText('Správa položek');
    await user.click(templateHeader);

    // Najít první šablonu a kliknout na editaci
    const editButtons = screen.getAllByTitle('Editovat');
    await user.click(editButtons[0]);

    // Změnit název
    const editInput = screen.getByDisplayValue(/Kuřecí prsa|Hovězí maso/i);
    await user.clear(editInput);
    await user.type(editInput, 'Upravená položka');

    // Uložit
    const saveButton = screen.getByTitle('Uložit');
    await user.click(saveButton);

    // Ověřit změnu
    await waitFor(() => {
      expect(screen.getByText('Upravená položka')).toBeInTheDocument();
    });
  });

  it('měla by zobrazit potvrzovací dialog při mazání šablony', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Otevřít správu položek
    const templateHeader = screen.getByText('Správa položek');
    await user.click(templateHeader);

    // Kliknout na smazání první nepoužité šablony
    const deleteButtons = screen.getAllByTitle(/Smazat|Položka je použita v mrazácích/i);
    const enabledDeleteButton = deleteButtons.find(btn => !(btn as HTMLButtonElement).disabled);
    
    if (enabledDeleteButton) {
      await user.click(enabledDeleteButton);

      // Ověřit potvrzovací dialog
      await waitFor(() => {
        expect(screen.getByText('Opravdu smazat šablonu?')).toBeInTheDocument();
      });

      // Zrušit
      const cancelButton = screen.getByText('Zrušit');
      await user.click(cancelButton);
    }
  });
});

describe('Mrazáky - Správa položek', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by přidat položku do šuplíku', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Najít první mrazák a otevřít šuplík
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    await user.click(addButtons[0]);

    // Vybrat šablonu
    const select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');

    // Zadat množství
    const quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '5');

    // Přidat položku
    const addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    // Ověřit, že položka byla přidána
    await waitFor(() => {
      expect(screen.getByText(/Kuřecí prsa/i)).toBeInTheDocument();
    });
  });

  it('měla by zobrazit potvrzovací dialog při mazání položky', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Přidat položku
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    await user.click(addButtons[0]);

    const select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');

    const quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '3');

    const addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    // Počkat na přidání
    await waitFor(() => {
      expect(screen.getByText(/Kuřecí prsa/i)).toBeInTheDocument();
    });

    // Zkusit smazat
    const deleteButtons = screen.getAllByText('🗑️');
    await user.click(deleteButtons[0]);

    // Ověřit potvrzovací dialog
    await waitFor(() => {
      expect(screen.getByText('Opravdu smazat?')).toBeInTheDocument();
    });
  });

  it('měla by aktualizovat množství položky', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Přidat položku
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    await user.click(addButtons[0]);

    const select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');

    const quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '5');

    const addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    // Počkat na přidání
    await waitFor(() => {
      expect(screen.getByText(/Kuřecí prsa/i)).toBeInTheDocument();
    });

    // Najít tlačítko + pro zvýšení množství
    const increaseButtons = screen.getAllByText('+');
    const itemIncreaseButton = increaseButtons.find(btn => 
      btn.parentElement?.textContent?.includes('Kuřecí prsa')
    );

    if (itemIncreaseButton) {
      await user.click(itemIncreaseButton);

      // Ověřit změnu množství
      await waitFor(() => {
        expect(screen.getByText(/6 ks/i)).toBeInTheDocument();
      });
    }
  });
});

describe('Detekce změn', () => {
  beforeEach(() => {
    localStorage.clear();
    // Inicializovat lastSyncedData
    localStorage.setItem('mrazaky-lastSyncedData', JSON.stringify({
      freezerData: { small: { 1: [], 2: [], 3: [] }, large: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }, smallMama: { 1: [] } },
      templates: []
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by detekovat změny po přidání položky', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Přidat položku
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    await user.click(addButtons[0]);

    const select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');

    const quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '3');

    const addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    // Ověřit, že se zobrazí tlačítko pro odeslání změn
    await waitFor(() => {
      const sendButton = screen.queryByText(/Odeslat změny do cloudu/i);
      expect(sendButton).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('měla by zobrazit "Zahodit změny" a "Pokračovat" při detekci změn', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Přidat položku
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    await user.click(addButtons[0]);

    const select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');

    const quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '3');

    const addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    // Počkat na změnu a kliknout na odeslání
    await waitFor(() => {
      const sendButton = screen.getByText(/Odeslat změny do cloudu/i);
      return user.click(sendButton);
    });

    // Ověřit, že se zobrazí toast s možnostmi
    await waitFor(() => {
      expect(screen.getByText(/Máte.*neuložené změny/i)).toBeInTheDocument();
      expect(screen.getByText('Zahodit změny')).toBeInTheDocument();
      expect(screen.getByText('Pokračovat')).toBeInTheDocument();
    });
  });
});

describe('Vyhledávání', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('mělo by vyhledat položky napříč mrazáky', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Přidat testovací položku
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    await user.click(addButtons[0]);

    const select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');

    const quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '5');

    const addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    // Otevřít vyhledávání
    const searchHeader = screen.getByText('🔍 Vyhledávání');
    await user.click(searchHeader);

    // Vyhledat
    const searchInput = screen.getByPlaceholderText(/Zadejte název položky/i);
    await user.type(searchInput, 'Kuřecí');

    // Ověřit výsledky
    await waitFor(() => {
      const results = screen.getAllByText(/Kuřecí prsa/i);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  it('mělo by zobrazit "Žádné výsledky" při nenalezení položky', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Otevřít vyhledávání
    const searchHeader = screen.getByText('🔍 Vyhledávání');
    await user.click(searchHeader);

    // Vyhledat neexistující položku
    const searchInput = screen.getByPlaceholderText(/Zadejte název položky/i);
    await user.type(searchInput, 'NeexistujiciPolozka123');

    // Ověřit zprávu
    await waitFor(() => {
      expect(screen.getByText(/Žádné výsledky/i)).toBeInTheDocument();
    });
  });
});

describe('Persistence dat', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by uložit data do localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Přidat položku
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    await user.click(addButtons[0]);

    const select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');

    const quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '7');

    const addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    // Počkat a zkontrolovat localStorage
    await waitFor(() => {
      const data = loadFreezerData();
      const hasItems = Object.values(data.small).some(drawer => drawer.length > 0) ||
                      Object.values(data.large).some(drawer => drawer.length > 0) ||
                      Object.values(data.smallMama).some(drawer => drawer.length > 0);
      expect(hasItems).toBe(true);
    });
  });

  it('měla by uložit šablony do localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Otevřít správu položek
    const templateHeader = screen.getByText('Správa položek');
    await user.click(templateHeader);

    // Přidat novou šablonu
    const addButton = screen.getByText('+ Přidat novou položku');
    await user.click(addButton);

    const input = screen.getByPlaceholderText('Název nové položky');
    await user.type(input, 'Testovací šablona pro persist');

    const submitButton = screen.getByRole('button', { name: /přidat/i });
    await user.click(submitButton);

    // Zkontrolovat localStorage
    await waitFor(() => {
      const templates = loadItemTemplates();
      expect(templates.some(t => t.name === 'Testovací šablona pro persist')).toBe(true);
    });
  });
});

describe('Editace názvu položky v šuplíku', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('měla by aktualizovat název položky ve všech šuplících', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Přidat stejnou položku do dvou šuplíků
    const addButtons = screen.getAllByText(/\+ Přidat/i);
    
    // První šuplík
    await user.click(addButtons[0]);
    let select = screen.getAllByRole('combobox')[0];
    await user.selectOptions(select, 'Kuřecí prsa');
    let quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[0], '3');
    let addItemButton = screen.getAllByText(/Přidat položku/i)[0];
    await user.click(addItemButton);

    await waitFor(() => {
      expect(screen.getByText(/Kuřecí prsa/i)).toBeInTheDocument();
    });

    // Druhý šuplík
    await user.click(addButtons[1]);
    select = screen.getAllByRole('combobox')[1];
    await user.selectOptions(select, 'Kuřecí prsa');
    quantityInputs = screen.getAllByLabelText(/Množství:/i);
    await user.type(quantityInputs[1], '5');
    addItemButton = screen.getAllByText(/Přidat položku/i)[1];
    await user.click(addItemButton);

    // Editovat název první položky
    const editButtons = screen.getAllByText('✏️');
    await user.click(editButtons[0]);

    const editInput = screen.getByDisplayValue('Kuřecí prsa');
    await user.clear(editInput);
    await user.type(editInput, 'Upravená kuřecí');
    await user.keyboard('{Enter}');

    // Ověřit, že se název změnil ve všech položkách
    await waitFor(() => {
      const updatedItems = screen.getAllByText(/Upravená kuřecí/i);
      expect(updatedItems.length).toBeGreaterThanOrEqual(2);
    });
  });
});
