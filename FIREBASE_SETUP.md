# Firebase Synchronizace - Nastavení

## Krok 1: Vytvoření Firebase projektu

1. Jděte na [Firebase Console](https://console.firebase.google.com/)
2. Klikněte na "Add project" nebo "Přidat projekt"
3. Pojmenujte projekt např. "mrazaky-app"
4. Vypněte Google Analytics (není potřeba)
5. Klikněte "Create project"

## Krok 2: Přidání webové aplikace

1. V přehledu projektu klikněte na ikonu **</>** (Web)
2. Pojmenujte aplikaci např. "Mrazaky Web"
3. **NEZAŠKRTÁVEJTE** "Firebase Hosting"
4. Klikněte "Register app"
5. **Zkopírujte** konfiguraci `firebaseConfig` objekt

## Krok 3: Nastavení Firestore Database

1. V levém menu klikněte na "Firestore Database"
2. Klikněte "Create database"
3. Vyberte **"Start in production mode"**
4. Vyberte region (europe-west1 nebo europe-west3)
5. Klikněte "Enable"

## Krok 4: Nastavení bezpečnostních pravidel

V Firestore → Rules → nahraďte pravidla tímto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sync-data/{syncCode} {
      // Každý může číst a zapisovat se znalostí sync kódu
      allow read, write: if true;
    }
  }
}
```

Klikněte "Publish"

## Krok 5: Vložení konfigurace do aplikace

1. Otevřete soubor `src/firebaseSync.ts`
2. Najděte řádek s `firebaseConfig`
3. **Nahraďte** jej konfigurací z kroku 2:

```typescript
const firebaseConfig = {
  apiKey: "VAŠE_API_KEY",
  authDomain: "vas-projekt.firebaseapp.com",
  projectId: "vas-projekt",
  storageBucket: "vas-projekt.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Krok 6: Build a deploy

```bash
git add .
git commit -m "Configure Firebase sync"
git push
```

## Hotovo! 🎉

Nyní máte funkční synchronizaci mezi zařízeními!

### Jak používat:

1. **První zařízení**: Klikněte "🔄 Nový sync kód" → vygenerujte kód (např. ABC123)
2. **Ostatní zařízení**: Klikněte "🔑 Zadat kód" → zadejte ABC123
3. Data se automaticky synchronizují mezi všemi zařízeními!

### Bezpečnost:

- Sync kód funguje jako heslo
- Bez kódu nikdo neuvidí vaše data
- Nesdílejte kód s nikým, komu nevěříte
- Kód můžete kdykoliv změnit vygenerováním nového
