# Mrazáky - Evidence obsahu

Aplikace pro správu obsahu mrazáků. Evidujte co máte v mrazácích a v kterých šuplících.

## Funkce

- **Malý mrazák** - 3 šuplíky
- **Velký mrazák** - 7 šuplíků
- **Správa položek**:
  - Přidávání položek ze seznamu
  - Přidávání vlastních položek
  - Editace množství (ks)
  - Mazání položek
- **Správa seznamu položek**:
  - Přidávání nových položek do seznamu
  - Mazání nepoužívaných položek
- **Perzistence dat** - vše se ukládá do localStorage prohlížeče

## Spuštění

### Lokálně

```bash
# Instalace závislostí
npm install

# Spuštění vývojového serveru
npm run dev
```

Aplikace bude dostupná na `http://localhost:5173`

### Build pro produkci

```bash
npm run build
```

Výstup bude ve složce `dist/`

## Nasazení na GitHub Pages

1. V [package.json](package.json) nastavte `homepage` na vaši GitHub Pages URL
2. Build projekt: `npm run build`
3. Nahrajte obsah složky `dist/` na GitHub Pages

## Technologie

- React 18
- TypeScript
- Vite
- CSS3
