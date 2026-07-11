# Cloud Functions — Lumi AI

Contém a função `askLumi`, que dá poder real ao painel de IA (a coruja Lumi).
O frontend chama essa função via `httpsCallable` (veja `src/lib/lumi.ts`) — a
chave da API nunca fica no navegador.

## Deploy (primeira vez)

```bash
# na raiz do projeto (se ainda não tiver o Firebase CLI)
npm install -g firebase-tools
firebase login
firebase use bookverse-8147a   # ou o projeto correto, se for outro

# dentro de /functions
cd functions
npm install

# guarda a chave da Anthropic como secret do Firebase (nunca vai pro código)
firebase functions:secrets:set ANTHROPIC_API_KEY

# build + deploy
npm run deploy
```

## Depois de qualquer alteração em `src/index.ts`

```bash
cd functions
npm run deploy
```

## Firestore — regras necessárias

O app grava em `users/{uid}` (perfil + XP para o ranking) e
`users/{uid}/library/{bookId}` (biblioteca pessoal). Exemplo de regras
mínimas (`firestore.rules` na raiz do projeto):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;

      match /library/{bookId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
      match /progress/{bookId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

Depois de criar/editar o arquivo:

```bash
firebase deploy --only firestore:rules
```

## Testando localmente (opcional)

```bash
cd functions
npm run build
firebase emulators:start --only functions,firestore,auth
```
