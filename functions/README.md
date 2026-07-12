# Cloud Functions — Lumi AI + Domínio Público

Contém três funções:
- `askLumi` — dá poder real ao painel de IA (a coruja Lumi).
- `searchPublicDomainBooks` e `getPublicDomainBook` — buscam e entregam
  **texto completo real** de livros em domínio público (Machado de Assis,
  Eça de Queirós, clássicos internacionais etc.) via [Project Gutenberg]
  (através do catálogo Gutendex), com cache em Firestore para não
  rebaixar/reprocessar o mesmo livro toda vez.

O frontend chama tudo isso via `httpsCallable` (veja `src/lib/lumi.ts` e
`src/lib/public-domain.ts`) — nenhuma chave de API nem lógica de parsing
fica no navegador.

## Deploy (primeira vez)

```bash
# na raiz do projeto (se ainda não tiver o Firebase CLI)
npm install -g firebase-tools
firebase login
firebase use bookverse-8147a   # ou o projeto correto, se for outro

# dentro de /functions
cd functions
npm install

# guarda a chave da Anthropic como secret do Firebase (só é usada por askLumi)
firebase functions:secrets:set ANTHROPIC_API_KEY

# build + deploy das 3 funções
npm run deploy
```

## Depois de qualquer alteração em `src/index.ts` ou `src/public-domain.ts`

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

**Nota:** a coleção `publicDomainBooks` (cache dos textos baixados do Project
Gutenberg) é escrita e lida só pelas Cloud Functions via Admin SDK, que
ignora as regras do Firestore — não precisa de regra própria a menos que
você queira consultá-la manualmente pelo Console.

## Testando localmente (opcional)

```bash
cd functions
npm run build
firebase emulators:start --only functions,firestore,auth
```
