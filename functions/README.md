# Cloud Functions — Lumi AI + Domínio Público + Catálogo Google Books

Contém cinco funções:
- `askLumi` — dá poder real ao painel de IA (a coruja Lumi), usando a
  **API do Groq** (Llama 3.3 70B) — escolhida de propósito porque o Groq
  emite chaves com um nível gratuito de verdade (limitado por taxa de
  requisições, não por créditos que acabam), sem precisar cadastrar
  cartão de crédito pra começar.
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

## Passo 0 — conseguir uma chave gratuita do Groq

1. Acesse **[console.groq.com](https://console.groq.com/)** e crie uma
   conta (e-mail, GitHub ou Google — sem cartão de crédito).
2. No menu lateral, vá em **API Keys** → **Create API Key**.
3. Copie a chave gerada (começa com `gsk_...`).
4. Isso já é suficiente — o nível gratuito do Groq não exige cartão de
   crédito. Ele é limitado por taxa de requisições (requisições/minuto e
   por dia), não por créditos que acabam, então não tem susto de fatura.

**Importante:** isso cobre só o custo do modelo de IA em si. As Cloud
Functions do Firebase (o "backend" que chama o Groq) continuam exigindo
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

# guarda a chave do Groq como secret do Firebase (só é usada por askLumi)
firebase functions:secrets:set GROQ_API_KEY

# build + deploy das 5 funções
npm run deploy
```

## Depois de qualquer alteração em `src/index.ts`, `src/public-domain.ts` ou `src/google-books.ts`

```bash
cd functions
npm run deploy
```

## Trocando o modelo do Groq

O nome do modelo usado (`llama-3.3-70b-versatile`) fica em uma única
constante no topo de `src/index.ts` (`MODEL_NAME`). Se esse modelo
específico for descontinuado, ou você quiser testar outro (ex: um menor
e mais rápido), confira a lista atual em
[console.groq.com/docs/models](https://console.groq.com/docs/models)
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

