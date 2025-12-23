# Testovací dokumentace

Tato aplikace obsahuje komplexní sadu automatických testů pro ověření správného chování všech klíčových funkcí.

## Spuštění testů

### Základní spuštění
```bash
npm test
```

### Spuštění s UI
```bash
npm run test:ui
```

### Coverage report
```bash
npm run test:coverage
```

## Struktura testů

### 1. `App.test.tsx` - Smoke testy
- Základní ověření, že aplikace se spustí
- Kontrola přítomnosti všech mrazáků
- Kontrola přítomnosti důležitých tlačítek

### 2. `AppBehavior.test.tsx` - Funkční testy
Komplexní testy chování aplikace:

#### Správa položek (šablon)
- ✅ Přidání nové šablony
- ✅ Editace existující šablony
- ✅ Potvrzovací dialog při mazání šablony
- ✅ Persistence šablon v localStorage

#### Správa položek v mrazácích
- ✅ Přidání položky do šuplíku
- ✅ Potvrzovací dialog při mazání položky
- ✅ Aktualizace množství položky
- ✅ Editace názvu položky s propagací do všech šuplíků

#### Vyhledávání
- ✅ Vyhledání položek napříč mrazáky
- ✅ Zobrazení "Žádné výsledky" při nenalezení

#### Persistence dat
- ✅ Ukládání dat do localStorage
- ✅ Ukládání šablon do localStorage

### 3. `ChangeDetection.test.tsx` - Detekce změn
Pokročilé testy logiky detekce změn:

#### Základní detekce
- ✅ Detekce změny při zvýšení množství
- ✅ Detekce návratu na původní hodnotu jako "bez změn"
- ✅ Několik změn za sebou detekováno jako jedna změna
- ✅ Žádná detekce po zahození změn

#### Persistence po reloadu
- ✅ Zachování lastSyncedData po reloadu
- ✅ Správná detekce změn i po reloadu

#### Propagace změn šablon
- ✅ Aktualizace všech položek při editaci šablony
- ✅ Označení šablony jako použité

## Klíčové scénáře, které testy hlídají

### 1. Detekce změn
**Scénář:** Uživatel změní množství položky, pak vrátí na původní hodnotu.
**Očekávání:** Po návratu na původní hodnotu by se nemělo zobrazovat "Odeslat změny".
**Test:** `ChangeDetection.test.tsx` - "měla by detekovat návrat na původní hodnotu"

### 2. Persistence po reloadu
**Scénář:** Uživatel udělá změnu, reloadne stránku, vrátí hodnotu na původní.
**Očekávání:** Po návratu na původní hodnotu by se nemělo zobrazovat "Odeslat změny".
**Test:** `ChangeDetection.test.tsx` - "měla by zachovat lastSyncedData po reloadu"

### 3. Potvrzovací dialogy
**Scénář:** Uživatel klikne na smazání položky nebo šablony.
**Očekávání:** Zobrazí se toast dialog s potvrzením, ne window.confirm.
**Test:** `AppBehavior.test.tsx` - "měla by zobrazit potvrzovací dialog"

### 4. Editace šablony
**Scénář:** Uživatel ve "Správě položek" edituje název šablony.
**Očekávání:** Název se změní ve všech položkách ve všech šuplících.
**Test:** `ChangeDetection.test.tsx` - "měla by aktualizovat všechny položky"

### 5. Zahodit změny
**Scénář:** Uživatel udělá změnu, pak klikne "Zahodit změny".
**Očekávání:** Data se vrátí do původního stavu, tlačítko "Odeslat změny" zmizí.
**Test:** `ChangeDetection.test.tsx` - "neměla by detekovat změnu po zahození"

## Spuštění konkrétního testu

```bash
# Spustit pouze testy detekce změn
npm test -- ChangeDetection

# Spustit pouze testy chování
npm test -- AppBehavior

# Spustit pouze smoke testy
npm test -- App.test
```

## Watch mode

Pro průběžný vývoj použijte watch mode:
```bash
npm test -- --watch
```

## Debug mode

Pro debugging testů:
```bash
npm test -- --inspect-brk
```

## CI/CD integrace

Testy jsou navrženy pro použití v CI/CD pipeline:
```bash
npm test -- --run --reporter=verbose
```

## Pokrytí kódu

Pro generování coverage reportu:
```bash
npm run test:coverage
```

Report se vytvoří v adresáři `coverage/`.

## Časté problémy

### Testy timeoutují
Zvyšte timeout v testu:
```typescript
await waitFor(() => {
  // ...
}, { timeout: 5000 });
```

### Mock data nejsou správná
Zkontrolujte `beforeEach` a ujistěte se, že localStorage je správně vyčištěn:
```typescript
beforeEach(() => {
  localStorage.clear();
});
```

## Přidání nových testů

Při přidání nové funkce přidejte testy do příslušného souboru:

1. **Základní funkčnost** → `AppBehavior.test.tsx`
2. **Detekce změn** → `ChangeDetection.test.tsx`
3. **Nové komponenty** → vytvořte nový soubor v `__tests__/`

## Struktura testu

```typescript
describe('Název funkcionality', () => {
  beforeEach(() => {
    // Příprava před každým testem
    localStorage.clear();
  });

  afterEach(() => {
    // Úklid po každém testu
    localStorage.clear();
  });

  it('měla by dělat konkrétní věc', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Interakce s UI
    await user.click(screen.getByText('Tlačítko'));

    // Ověření výsledku
    await waitFor(() => {
      expect(screen.getByText('Očekávaný text')).toBeInTheDocument();
    });
  });
});
```

## Best practices

1. ✅ Vždy čistit localStorage v `beforeEach` a `afterEach`
2. ✅ Používat `waitFor` pro asynchronní operace
3. ✅ Používat `userEvent` místo `fireEvent`
4. ✅ Testovat chování, ne implementaci
5. ✅ Psát popisné názvy testů ("měla by..." místo "test1")
