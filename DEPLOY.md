# Publicar o BookVerse

O app é um projeto TanStack Start comum: `npm run build` gera `.output/`
com o site e o servidor. O Nitro escolhe o formato certo para a hospedagem
automaticamente.

## 1. Variável obrigatória

| Variável | O que é |
| --- | --- |
| `GOOGLE_API_KEY` | Chave **Web API Key** do Firebase (Console do Firebase → Configurações do projeto → Geral). É um identificador público; a segurança vem das regras do Firestore/Storage. |

Sem ela, o app abre, mas login, estante e ranking ficam indisponíveis e uma
faixa de aviso aparece no topo.

## 2. Hospedagem

### Vercel (recomendado)
1. Importe o repositório na Vercel.
2. Em **Settings → Environment Variables**, crie `GOOGLE_API_KEY`.
3. Build command `npm run build` (padrão). O Nitro detecta a Vercel sozinho.

### Netlify / Cloudflare
Mesma ideia: defina `GOOGLE_API_KEY` e use `npm run build`. Para forçar um
alvo, use `NITRO_PRESET` (ex.: `NITRO_PRESET=netlify`,
`NITRO_PRESET=cloudflare-module`).

### Servidor próprio (Node)
```bash
GOOGLE_API_KEY=... npm run build
PORT=3000 node .output/server/index.mjs
```

## 3. Firebase (regras e funções)

Projeto padrão: `bookverse-8147a` (veja `.firebaserc`).

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage
```

As Cloud Functions (Lumi, acervo de domínio público e catálogo) têm um guia
próprio em [`functions/README.md`](functions/README.md), incluindo a chave
gratuita do Groq usada pela Lumi (`firebase functions:secrets:set GROQ_API_KEY`).

### Leitura como convidado
Visitantes leem clássicos de domínio público sem criar conta, usando o login
anônimo do Firebase. Ative em **Authentication → Sign-in method → Anônimo**.
Quando o visitante cria a conta depois, a sessão anônima é vinculada e o
progresso é mantido.

## 4. Desenvolvimento local

```bash
npm install
GOOGLE_API_KEY=... npm run dev   # http://localhost:8080
```
