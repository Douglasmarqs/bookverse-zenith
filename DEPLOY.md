# Diagnóstico rápido — capas, catálogo e login

Se depois de aplicar esta versão os problemas abaixo continuarem, o mais
provável é que o **build publicado não tenha essas mudanças ainda** (faltou
recompilar/redeploy) ou que falte configuração fora do código (que eu não
tenho como ajustar por aqui). Este arquivo é o checklist pra descartar cada
causa, na ordem mais provável primeiro.

## 1. "Não consigo criar conta / entrar com Google"

Praticamente sempre é uma destas 3 causas, nesta ordem de probabilidade:

**a) Falta a variável `GOOGLE_API_KEY` no build**
Sem ela, o Firebase nunca inicializa e login/conta simplesmente não funcionam
— sem exceção. Nesta versão isso agora aparece como um aviso vermelho no
topo do site e na página de login (antes falhava calado). Se você está
vendo esse aviso: configure `GOOGLE_API_KEY` = a **Web API Key** do seu
projeto Firebase (Console → Configurações do projeto → Geral → chave de API
Web) como variável/segredo de build na plataforma onde você publica (Lovable,
Vercel, Cloudflare Pages etc.) e refaça o deploy.

**b) Provedores não habilitados no Firebase Console**
Vá em **Authentication → Sign-in method** e confirme que **E-mail/senha** e
**Google** estão como "Ativado". Se estiverem desligados, toda tentativa
falha com um erro específico que agora aparece na tela (`auth/operation-not-allowed`).

**c) Domínio não autorizado**
Em **Authentication → Settings → Authorized domains**, adicione o domínio
onde o site está publicado (ex: `bookverse.online` e o domínio de preview,
se usar um). Sem isso o popup do Google fecha sozinho ou retorna
`auth/unauthorized-domain` — mensagem que também já aparece na tela agora.

## 2. "As capas não são reais" / "Descobrir não mostra nada"

Corrigi dois bugs reais nesta leva:
- A busca por categoria usava `subject:Ficção` etc. — esse operador do Google
  Books só bate com a taxonomia interna deles (majoritariamente em inglês),
  então praticamente nunca retornava nada. Agora a categoria entra como termo
  de busca livre, que funciona de verdade.
- A página `/descobrir` só buscava algo se você digitasse um termo. Agora ela
  já chega com uma seleção padrão, então nunca aparece vazia.

Se mesmo assim continuar sem nenhuma capa/resultado em lugar nenhum do site
(nem na home, nem em `/descobrir`), o mais provável é que a rede da
plataforma onde o site está hospedado esteja bloqueando saída para
`www.googleapis.com` — nesse caso a tela agora mostra um aviso
"Não conseguimos falar com o Google Books agora" em vez de ficar em branco
silenciosamente, o que ajuda a confirmar se é isso. Teste abrir o DevTools
(F12 → Network) e veja se a chamada para `googleapis.com/books/v1/volumes`
aparece bloqueada/vermelha.

## 3. Você ainda está vendo a versão antiga

Este código não se auto-publica. Depois de baixar este zip:
1. Suba os arquivos para onde o projeto é hospedado (Lovable, GitHub, etc.).
2. Rode o build de novo (`npm install && npm run build` ou o botão de
   deploy da plataforma).
3. Confirme, olhando o código publicado, que os arquivos batem com os deste
   zip — em especial `src/lib/google-books.ts` e `src/routes/descobrir.tsx`.

## 4. IA (Lumi) e Firestore

Continuam exigindo o deploy manual descrito em `functions/README.md`
(secret `ANTHROPIC_API_KEY` + `firebase deploy`) e as regras do Firestore
do mesmo arquivo — isso não muda com este pacote.

## 5. Nova função: leitura real de livros (domínio público)

Agora existe uma segunda fonte de livros, além do catálogo comercial
(Google Books, só capa/metadados): **livros de domínio público com texto
completo real**, buscados no Project Gutenberg. Aparecem como "Ler agora"
na home e em `/descobrir`, e abrem no mesmo leitor do app — capítulos de
verdade, não mais lorem ipsum.

Isso depende das duas novas Cloud Functions (`searchPublicDomainBooks` e
`getPublicDomainBook`) — o `functions/README.md` já foi atualizado, e
`npm run deploy` dentro de `/functions` agora publica as três funções juntas.

**Importante sobre o alcance:** domínio público significa livros cujo
direito autoral já expirou — Machado de Assis, Eça de Queirós, clássicos
russos/franceses/ingleses do século 19, etc. Best-sellers e lançamentos
recentes **nunca** vão ter texto completo no app (isso seria pirataria);
para esses, o app continua mostrando capa/sinopse reais com link para onde
comprar/ler oficialmente — é a mesma distinção que expliquei antes no chat.
