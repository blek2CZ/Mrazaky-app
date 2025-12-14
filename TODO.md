# 📋 MRAZAKY-APP - REFACTOR TODO

**Datum zahájení:** 14.12.2025  
**Cíl:** Zlepšit kvalitu kódu, výkon a udržovatelnost

---

## 🔴 FÁZE 1: STABILIZACE (PRIORITA KRITICKÁ)

### ✅ Dokončeno
- [x] Analýza projektu provedena
- [x] TODO soubor vytvořen
- [x] Testovací infrastruktura připravena
- [x] **1.1 Setup testů (Vitest + Testing Library)**
  - [x] Instalace dependencies (vitest, @testing-library/react, happy-dom)
  - [x] Konfigurace vitest.config.ts
  - [x] Setup soubory (__tests__, __mocks__)
  - [x] První smoke test (5 testů, 100% passing ✅)
  - [x] Firebase mocks pro izolované testy

### 🚧 Probíhá
- [ ] **1.2 Vyčlenění modalů z App.tsx**
  - [ ] ConflictResolutionModal.tsx + testy
  - [x] DisconnectModal.tsx + testy ✅ (21/21 tests)
  - [x] LoadingOverlay.tsx + testy ✅
  - [ ] Aktualizace App.tsx

### 📝 Čeká
  
- [ ] **1.3 Vyčlenění notification systému**
  - [ ] NotificationSnackbar.tsx + testy
  - [ ] useNotifications hook + testy
  - [ ] Integrace do App.tsx

- [ ] **1.4 Vyčlenění sync status bar**
  - [ ] SyncStatusBar.tsx + testy
  - [ ] Integrace do App.tsx

- [ ] **1.5 Vytvoření custom hooks**
  - [ ] useFreezerData.ts + testy
  - [ ] useFirebaseSync.ts + testy
  - [ ] useConflictResolution.ts + testy

- [ ] **1.6 Refactor state management**
  - [ ] Návrh AppState interface
  - [ ] Implementace useReducer
  - [ ] Migrace všech 19 useState
  - [ ] Testy reducer funkcí

- [ ] **1.7 Cleanup debug kódu**
  - [ ] Vytvoření logger utility
  - [ ] Nahrazení console.log
  - [ ] Ověření production build

- [ ] **1.8 Error Boundary**
  - [ ] Implementace ErrorBoundary komponenty
  - [ ] Error logging service
  - [ ] Testy

- [ ] **1.9 TypeScript strict mode**
  - [ ] Aktualizace tsconfig.json
  - [ ] Oprava type errors
  - [ ] Verifikace

---

## 🟡 FÁZE 2: OPTIMALIZACE (PRIORITA VYSOKÁ)

- [ ] **2.1 Performance optimalizace**
  - [ ] React.memo na komponenty
  - [ ] useMemo pro výpočty
  - [ ] useCallback pro handlery
  - [ ] Debounce localStorage uložení

- [ ] **2.2 Firebase offline strategie**
  - [ ] Offline queue implementace
  - [ ] Rate limiting
  - [ ] Exponenciální backoff
  - [ ] Testy offline scénářů

- [ ] **2.3 Code splitting**
  - [ ] Lazy load Firebase
  - [ ] Manual chunks konfigurace
  - [ ] Dynamic imports pro modaly

- [ ] **2.4 Service Worker**
  - [ ] vite-plugin-pwa instalace
  - [ ] Workbox konfigurace
  - [ ] Offline functionality

---

## 🟢 FÁZE 3: ROZŠÍŘENÍ (PRIORITA STŘEDNÍ)

- [ ] **3.1 Unit testy - pokrytí 80%+**
  - [ ] Všechny utils (storage, firebaseSync, etc.)
  - [ ] Všechny komponenty
  - [ ] Všechny hooks

- [ ] **3.2 Accessibility (A11y)**
  - [ ] ARIA atributy
  - [ ] Keyboard navigation
  - [ ] Screen reader support

- [ ] **3.3 UX vylepšení**
  - [ ] Keyboard shortcuts
  - [ ] Touch gestures
  - [ ] Haptic feedback
  - [ ] Loading skeletons

- [ ] **3.4 Bezpečnost**
  - [ ] Environment variables pro Firebase
  - [ ] AdminAuth Context
  - [ ] Security audit

- [ ] **3.5 Analytics**
  - [ ] Firebase Analytics setup
  - [ ] Event tracking
  - [ ] Error monitoring

---

## 📊 METRIKY

### Před refaktorem
- **Řádky kódu:** 2387
- **App.tsx:** 1356 řádků
- **useState v App:** 19
- **Bundle size:** 513 KB
- **Test coverage:** 0%
- **TypeScript strict:** ❌

### Cíl po refaktoru
- **App.tsx:** < 200 řádků
- **useState v App:** < 5 (zbytek v hooks/context)
- **Bundle size:** < 350 KB
- **Test coverage:** > 80%
- **TypeScript strict:** ✅

---

## 🐛 ZNÁMÉ BUGY

1. ⚠️ Firebase Promise neresolvuje při quota error → Timeout workaround 10s
2. ⚠️ Synchronní localStorage blokuje UI
3. ⚠️ Žádná offline funkcionalita
4. ⚠️ Re-render celé app při každé změně freezerData

---

## 📝 POZNÁMKY

- Každá změna musí mít testy PŘED merge
- Testy spouštět: `npm test`
- Build kontrola: `npm run build`
- Po každé fázi: code review + dokumentace

---

**Poslední aktualizace:** 14.12.2025 22:00
