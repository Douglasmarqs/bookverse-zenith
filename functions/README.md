# Cloud Functions — Lumi AI + Domínio Público + Catálogo Google Books

Contém cinco funções:
- `askLumi` — dá poder real ao painel de IA (a coruja Lumi), usando a
  **API do Gemini (Google)** — escolhida de propósito porque o Google AI
  Studio emite chaves com um nível gratuito de verdade, sem precisar
  cadastrar cartão de crédito pra começar.
- `searchPublicDomainBooks` e `getPublicDomainBook` — buscam e entregam
  **texto completo real** de livros em domínio público (Machado de Assis,
  Eça de Queirós, clássicos internacionais etc.) via [Project Gutenberg]
  (através do catálogo Gutendex), com cache em Firestore para não
  rebaixar/reprocessar o mesmo livro toda vez.
- `searchGoogleBooks` e `getGoogleBookMeta` — buscam capa/sinopse reais no
  catálogo comercial (Google Books) a partir do backend em vez do
  navegador. Existem porque chamar `googleapis.com` direto do navegador é
  bloqueado com frequência por bloqueadores de anúncio/privacidade e por
  algumas redes corporativas/escolares — o frontend ainda tenta a chamada
  direta como plano B se as functions não estiverem disponíveis (veja
  `src/lib/google-books.ts`), mas a via recomendada é sempre esta.

O frontend chama tudo isso via `httpsCallable` (veja `src/lib/lumi.ts`,
`src/lib/public-domain.ts` e `src/lib/google-books.ts`) — nenhuma chave de
API nem lógica de parsing fica no navegador.

## Passo 0 — conseguir uma chave gratuita do Gemini

1. Acesse **[aistudio.google.com](https://aistudio.google.com/)** com
   qualquer conta Google.
2. No menu, clique em **Get API key** → **Create API key**.
3. Escolha um projeto do Google Cloud (pode ser um novo, criado na hora)
   e copie a chave gerada (começa com algo como `AIza...`).
4. Isso já é suficiente — o nível gratuito do Gemini não exige cartão de
   crédito. Se precisar de mais volume no futuro, dá pra vincular
   faturamento depois, mas não é necessário pra começar.

**Importante:** isso cobre só o custo do modelo de IA em si. As Cloud
Functions do Firebase (o "backend" que chama o Gemini) continuam exigindo
o plano **Blaze** (pay-as-you-go) do Firebase — é um requisito do
Firebase pra qualquer function fazer chamadas de rede, independente de
qual IA você usa. O Blaze tem cota gratuita mensal generosa; um app
pessoal como este dificilmente passa dela.

## Deploy (primeira vez)

```bash
# na raiz do projeto (se ainda não tiver o Firebase CLI)
npm install -g firebase-tools
firebase login
firebase use bookverse-8147a   # já é o padrão definido em .firebaserc

# dentro de /functions
cd functions
npm install

# guarda a chave do Gemini como secret do Firebase (só é usada por askLumi)
firebase functions:secrets:set GEMINI_API_KEY

# build + deploy das 5 funções
npm run deploy
```

## Depois de qualquer alteração em `src/index.ts`, `src/public-domain.ts` ou `src/google-books.ts`

```bash
cd functions
npm run deploy
```

## Trocando o modelo do Gemini

O nome do modelo usado (`gemini-2.0-flash`) fica em uma única constante
no topo de `src/index.ts` (`MODEL_NAME`). Se esse modelo específico não
estiver disponível pra sua chave, ou o Google lançar uma versão mais
nova, confira a lista atual em
[ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
e troque só essa constante — o resto da function não muda.

## Firestore — regras necessárias

O app grava em `users/{uid}` (perfil + XP para o ranking),
`users/{uid}/library/{bookId}` (biblioteca pessoal),
`users/{uid}/progress/{bookId}` (progresso de leitura),
`users/{uid}/annotations/{bookId}` (destaques e marcadores) e
`users/{uid}/lumi/{contextKey}` (histórico de conversa com a Lumi). As
regras já estão prontas em `firestore.rules` na raiz do projeto (junto com
`firebase.json` e `.firebaserc`, que também já apontam para este projeto)
— não é preciso criar nada, só publicar:

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

