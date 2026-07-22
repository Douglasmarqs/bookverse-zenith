# Diagnóstico rápido — capas, catálogo e login

## 🆕 Atualização — texto quebrado corrigido, catálogo com 3ª fonte de dados, perfil novo

### O bug do texto quebrado em pedaços (Sun Tzu e possivelmente outros)

Achei a causa real: o algoritmo que separa o texto em capítulos, quando uma
linha de marcação de capítulo vinha seguida de uma frase longa na mesma
linha (comum em certas edições do Gutenberg), acabava (1) jogando aquela
frase inteira dentro do **título** do capítulo em vez do corpo do texto, e
(2) como o texto original quebra linha a cada poucas palavras com linha em
branco entre elas, cada fragmento curto virava um "parágrafo" separado —
daí o efeito de frase picada ("batalha;" / "se" / "estivermos" cada um
isolado).

Corrigido dos dois lados (Cloud Function e navegador direto):
- Título do capítulo agora fica limpo; texto longo que vier "grudado" na
  linha de marcação vai para o corpo, não para o título.
- Parágrafos fragmentados são remontados automaticamente até formarem uma
  frase completa (termina em `.`, `!` ou `?`) — testei contra uma
  reprodução exata do bug reportado e o resultado agora sai como texto
  corrido, do jeito que deveria ser.
- Apliquei o mesmo cuidado no importador de EPUB, para textos sem `<p>`
  bem marcado.

**Esse ajuste já está no código, mas — assim como toda mudança de
`functions/` — só tem efeito depois de rodar `firebase deploy` dentro de
`/functions` de novo** (ou, no caminho sem Cloud Function, só precisa do
redeploy do site mesmo).

### Catálogo geral: agora com uma 3ª fonte de dados

O erro "rede bloqueada" que continuou aparecendo depois da correção
anterior é porque o Google Books (Cloud Function *e* chamada direta do
navegador) segue bloqueado no seu ambiente. Em vez de insistir só nisso,
adicionei uma **terceira camada**: se as duas primeiras falharem, o app
agora busca no Open Library (mesma fonte que já funciona na seção
"Tendências da semana", como dá pra ver no seu próprio print) — tanto para
a busca do catálogo geral quanto para a capa/sinopse na página de detalhes
de cada livro. Isso deve resolver tanto a mensagem de erro quanto as capas
que apareciam só como texto (ex: "Harry Potter and the Philosopher's
Stone" sem capa real).

### Bug real no upload de EPUB: capa grande demais podia travar o salvamento

O Firestore tem um limite de 1MB por documento. A capa de um EPUB, extraída
do próprio arquivo, ia direto pro banco em tamanho original — em capas
maiores, isso passava do limite e o livro ficava salvo *localmente* (no
navegador) mas falhava silenciosamente ao entrar na sua biblioteca online.
Agora toda capa de EPUB é redimensionada (480px, JPEG) antes de salvar, e
adicionei uma trava extra que descarta a capa (em vez de falhar tudo) se
por algum motivo ela ainda vier grande demais.

### Novo: tela de perfil e configurações de conta

Em **Meu perfil** (link no menu da conta, no canto superior direito):
- Avatar escolhível entre 16 opções, nome de exibição editável.
- Resumo de XP, livros concluídos e itens na biblioteca.
- Trocar senha (para contas de e-mail/senha) com reautenticação.
- Excluir conta — apaga perfil, biblioteca e progresso, com confirmação
  explícita (digitar "EXCLUIR" + senha) antes de executar.

### Sobre os livros "que não dá pra nem clicar"

Não consegui reproduzir esse ponto especificamente sem saber exatamente
quais itens — mas a instabilidade generalizada do catálogo (que agora tem
uma fonte de dados de reserva) era a causa mais provável de comportamento
inconsistente entre os cards. Se depois desta atualização ainda sobrar
algum item específico impossível de clicar, me diga qual exatamente (nome
do livro + em qual página) que eu vou direto nele.

---

## 🆕 Atualização — resolve "Missing or insufficient permissions", leitura sem depender de Cloud Functions, e EPUB próprio

### ⚠️ Ação mais importante: publicar as regras do Firestore (sem precisar de CLI)

O erro **"Missing or insufficient permissions"** que apareceu na tela é o
Firestore recusando a escrita porque as regras em `firestore.rules` (que eu
já tinha criado numa atualização anterior) **ainda não foram publicadas no
seu projeto**. Sem published rules, toda escrita (adicionar à biblioteca,
XP, progresso de leitura) é recusada — por isso "adicionar" continuava sem
efeito.

Boa notícia: dá pra resolver isso **sem instalar nada**, direto pelo
navegador:

1. Acesse o [Firebase Console](https://console.firebase.google.com/) →
   selecione o projeto `bookverse-8147a`.
2. No menu lateral: **Firestore Database** → aba **Regras** (Rules).
3. Apague o conteúdo atual e cole o conteúdo do arquivo `firestore.rules`
   (na raiz deste projeto).
4. Clique em **Publicar** (Publish).

Pronto — sem CLI, sem terminal. Isso é o passo que resolve o erro da
imagem. (Se preferir CLI: `firebase deploy --only firestore:rules`.)

### Leitura agora funciona mesmo sem publicar as Cloud Functions

Até esta atualização, abrir um livro de domínio público dependia 100% das
Cloud Functions (`searchPublicDomainBooks`/`getPublicDomainBook`) estarem
publicadas — se você ainda não tinha rodado `firebase deploy` dentro de
`/functions`, a leitura simplesmente não funcionava, sem alternativa.

Agora, seguindo o mesmo padrão que já existia para o Google Books: o app
tenta a Cloud Function primeiro e, se ela não responder, busca o catálogo
e o texto **direto do navegador** (Gutendex + Project Gutenberg). Ou seja,
**ler um livro de domínio público já deve funcionar mesmo que você nunca
tenha publicado nenhuma Cloud Function.** Publicar as functions continua
sendo o caminho mais eficiente (cache no Firestore, sem depender de CORS
de mirrors do Gutenberg), mas deixou de ser um bloqueio.

### Sobre a API que você indicou (Gutendex)

O link que você mandou é uma página de listagem sobre a API **Gutendex**
— e ela já está integrada no projeto desde a atualização anterior (é
exatamente o que alimenta a seção "Domínio público" em Descobrir, Catálogo
e na Home, usando `gutendex.com` por baixo dos panos). Não precisa de nada
adicional aí.

### Novo: adicionar e ler seus próprios EPUBs

Em **Minha biblioteca**, tem um botão **"Adicionar EPUB"**. Ele:
- Lê o arquivo `.epub` inteiramente no navegador (sem enviar pra nenhum
  servidor) usando a biblioteca `jszip`, extrai capítulos, capa, título e
  autor, e guarda tudo localmente (IndexedDB do navegador).
- Adiciona o livro à sua biblioteca com um clique em "Ler agora" na
  notificação de sucesso, e abre no mesmo leitor usado para os outros
  livros — mesmas configurações de fonte, tema, progresso salvo, etc.
- **Importante:** como o texto fica salvo só no navegador onde você
  importou, abrir esse mesmo livro em outro dispositivo/navegador vai
  pedir para importar de novo lá (a *entrada* na biblioteca sincroniza
  normalmente pelo Firestore, mas o *arquivo* em si é local — evita
  precisar configurar Firebase Storage). Isso fica indicado com uma
  etiqueta "Arquivo local (EPUB)" no card do livro.
- Suporta EPUB2 e EPUB3, com ou sem capa, e tem um fallback para livros
  sem `<p>` bem marcados no HTML.

**Sobre o arquivo `.rar` de 1300 livros que você enviou:** não usei o
conteúdo dele. É uma coletânea de livros com direitos autorais distribuída
sem autorização — não uso esse tipo de material pra popular o catálogo ou
qualquer outra parte do site, mesmo que fosse só pra teste. O recurso de
EPUB acima é genérico: funciona com qualquer arquivo que você mesmo
importar, um de cada vez.

### Erros mais claros em qualquer operação de biblioteca

Em vez de mostrar a mensagem crua do Firebase (tipo "Missing or
insufficient permissions."), adicionar/remover/mudar status agora traduz
os erros mais comuns (permissão, sessão expirada, sem conexão, muitas
tentativas) para uma frase direta em português.

---

## 🆕 Atualização — corrigido: "adiciono um livro e fica carregando" + botões sem reação

Você relatou que adicionar livros ficava travado em "carregando" e que
vários botões pareciam não fazer nada. Encontrei bugs reais — não era só
achismo. Resumo:

### O bug principal: `Promise.all` travando a página inteira

Na aba **Catálogo**, os quatro carregamentos da página (em alta,
bestsellers, domínio público, prateleiras por assunto) rodavam num único
`Promise.all([...])`. Se **qualquer um** desses falhasse (uma instabilidade
pontual na API do Open Library, por exemplo), a promessa inteira rejeitava
e a linha que tira a página do estado "carregando" nunca era executada —
a página ficava com o spinner girando pra sempre, mesmo que os outros três
carregamentos tivessem dado certo. Troquei para `Promise.allSettled` +
`try/finally`, então agora **cada seção aparece com o que conseguiu
carregar**, e a página nunca mais fica presa no "carregando".

### O bug dos botões "sem função": nenhum tratamento de erro

Todos os botões de **"Adicionar"/"Salvar" na biblioteca** (em Descobrir,
Catálogo e na página de detalhes do livro) chamavam `addToLibrary(...)`
sem `try/catch`. Quando essa chamada falhava por qualquer motivo (rede
instável, regra do Firestore, timeout), duas coisas aconteciam dependendo
da página:
- Na página de detalhes do livro, o botão tinha um estado de "Salvando…"
  que **nunca voltava ao normal** — ficava girando pra sempre.
- Em Descobrir/Catálogo, o clique simplesmente não fazia nada visível —
  parecia um botão morto.

Agora:
- **Toda** operação de biblioteca (adicionar, remover, mudar status) tem
  `try/catch/finally` — o botão sempre volta ao normal, sucesso ou erro.
- Erros aparecem como uma notificação (toast) na tela, em vez de falhar em
  silêncio. Adicionei o componente de notificação (`sonner`, que já estava
  instalado no projeto mas nunca tinha sido ativado) no layout principal.
- `addToLibrary`, `markAsReading`, `removeFromLibrary` e
  `setLibraryStatus` agora têm um **limite de tempo real** (a leitura
  opcional cai para um valor padrão em 5s; a gravação, se travar de
  verdade, retorna um erro claro em até 10s) — nada mais fica girando
  indefinidamente, nem quando a rede está ruim.
- O mesmo tratamento foi aplicado ao perfil do usuário (XP, criação de
  perfil no primeiro login) e ao progresso de leitura salvo no servidor.

### Reforço extra

Adicionei um limite de 10s também no Ranking e em "Minha biblioteca": se a
conexão em tempo real do Firestore não responder nem com sucesso nem com
erro (situação rara, mas possível em redes muito instáveis), a página sai
do "carregando" sozinha em vez de esperar para sempre.

Se depois de publicar esta versão *ainda* sobrar algum botão específico
sem reação, me diga exatamente qual — meu palpite é que os acima cobrem os
casos reais, mas com um alvo exato eu vou direto na causa.

---

## 🆕 Atualização — leitura conectada à biblioteca, catálogo à prova de bloqueio, tela de login nova

Resumo do que mudou nesta leva e **o que você precisa fazer manualmente**
(não tenho como publicar Firebase/Vercel por aqui — só entrego o código).

### O que foi corrigido/adicionado

1. **Catálogo do Google Books agora passa por Cloud Function**
   (`searchGoogleBooks` / `getGoogleBookMeta`, em `functions/src/google-books.ts`).
   O erro "Não conseguimos falar com o Google Books agora" que você viu
   acontece porque o navegador chama `googleapis.com` diretamente — e isso é
   bloqueado por bloqueadores de anúncio/privacidade e por algumas redes
   corporativas/escolares com muita frequência. Agora a chamada primeiro
   passa pelo backend (Cloud Functions, que não tem esse problema de rede) e
   só cai para a chamada direta do navegador como plano B. Isso deixa o
   catálogo, as capas da home e a busca em `/descobrir` muito mais
   confiáveis, mas **depende de você publicar as novas functions** (passo a
   passo abaixo).

2. **Ler um livro agora conecta automaticamente com "Minha biblioteca".**
   Antes, adicionar um livro à biblioteca e conseguir realmente lê-lo eram
   dois mundos separados — um livro salvo não tinha como abrir o leitor de
   volta, e ler um livro não aparecia na biblioteca. Agora:
   - Abrir qualquer livro no leitor (domínio público ou o livro de exemplo)
     já marca automaticamente como "Lendo" na sua biblioteca.
   - Terminar o último capítulo marca como "Concluído".
   - Em "Minha biblioteca", cada item agora tem um botão — **"Continuar
     lendo"** (abre o leitor) para livros com texto completo, ou **"Ver
     detalhes"** para livros que são só catálogo (Google Books/Open Library,
     sem texto completo disponível).
   - Nos cartões de domínio público (`/descobrir` e `/catalogo`) agora
     também tem um botão **"Salvar"** separado do "Ler agora", pra quem quer
     só guardar pra depois sem abrir o leitor ainda.

3. **Home real, sem dados de mentira.** A seção "Continue lendo" mostrava
   3 livros fixos que não tinham nada a ver com sua conta. Agora ela mostra
   os livros que *você* está lendo de verdade (ou um convite para começar,
   se ainda não tiver nenhum). A prateleira "Em alta" também trocou de dados
   inventados para o mesmo dado real de tendências semanais do Open Library
   já usado em "Bestsellers".

4. **Tela de login/cadastro refeita.** Layout novo em duas colunas (com
   painel de destaque em telas maiores), mostrar/ocultar senha, confirmação
   de senha e indicador de força no cadastro, checkbox obrigatório de
   aceite dos Termos/Privacidade, e um fluxo de **"Esqueci minha senha"**
   (envia e-mail de redefinição via Firebase Auth) que não existia antes.

5. **Lumi (IA) não falha mais silenciosamente para quem nunca logou.**
   Se alguém clicasse em "IA" no menu sem nunca ter entrado na conta, a
   chamada falhava com uma mensagem genérica. Agora ela garante uma sessão
   (mesmo anônima) antes de chamar a função, e mostra uma mensagem clara se
   isso não for possível.

6. **Arquivos de configuração do Firebase que faltavam.** O projeto nunca
   teve `firebase.json`, `.firebaserc` nem `firestore.rules` no repositório
   — ou seja, os comandos de `firebase deploy` do `functions/README.md`
   não tinham como funcionar do zero. Agora existem os três, apontando para
   o projeto `bookverse-8147a` (o mesmo já usado em `src/lib/firebase.ts`).

7. **Etiqueta de idioma nos livros de domínio público.** A busca no
   Gutenberg aceita português *e* inglês, e a aba "Catálogo" busca por
   padrão o termo "classic literature" (em inglês) — então nem tudo que
   aparece ali está em português. Agora cada capa mostra uma etiqueta
   (ex: "Português" / "Inglês") no canto, antes de você clicar em "Ler
   agora".

### O que você precisa fazer para isso valer no site publicado

1. **Publicar as Cloud Functions** (inclui as duas novas do Google Books):
   ```
   cd functions
   npm install
   npm run deploy
   ```
   Se for a primeira vez configurando Firebase neste diretório, rode antes
   `firebase login` e confirme que o projeto é `bookverse-8147a`
   (`firebase use bookverse-8147a` — o `.firebaserc` novo já deixa isso
   automático).

2. **Publicar as regras do Firestore** (novo `firestore.rules`, nunca
   publicado antes):
   ```
   firebase deploy --only firestore:rules
   ```

3. **Redeploy do site (Vercel/onde estiver hospedado)** com este código —
   sem isso, o site publicado continua com a versão antiga.

Os itens 4–6 do checklist original abaixo (login, domínio autorizado,
segredo `ANTHROPIC_API_KEY` da Lumi) continuam valendo exatamente como
estavam — não mudaram nesta leva.

---

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
