# Diagnóstico rápido — capas, catálogo e login

## 🆕 Atualização URGENTE — corrigido o travamento ao clicar em livros

### O bug real do travamento

Achei a causa: a busca no Open Library (usada como 3ª tentativa quando o
Google Books falha) **não tinha nenhum limite de tempo** — diferente de
todo o resto do código, que já tinha proteção contra isso. Se a rede
travasse ali, o navegador ficava esperando indefinidamente, sem erro, sem
aviso — exatamente a sensação de "trava tudo" ao clicar num livro.

Além disso, as chamadas às Cloud Functions não tinham limite de tempo
configurado — o padrão do Firebase é **70 segundos**. Então, no seu caso
específico (Cloud Functions ainda não publicadas), cada clique podia
ficar esperando até 70s só nessa etapa, antes mesmo de cair nas
alternativas seguintes.

**Corrigido em 6 lugares**: toda chamada de rede do app (Open Library,
Cloud Functions do navegador, e também dentro das próprias Cloud
Functions no servidor) agora tem um limite de tempo real — no pior caso,
alguns segundos de espera com uma mensagem clara, nunca mais uma tela
travada sem explicação.

### Por que o "CATÁLOGO GERAL" ainda aparecia no seu print

Aquele texto **não existe mais no código** há várias atualizações — o
print era de uma versão desatualizada do site publicado. Isso costuma
acontecer quando o código é atualizado aqui mas ainda não foi
reenviado pro GitHub/Vercel. Confirme que o zip mais recente foi
publicado de verdade (commit + push, ou reupload no Lovable) antes de
testar de novo.

### Erros agora mostram a causa exata

Login e Lumi mostravam mensagens genéricas tipo "Não foi possível
concluir" sem dizer o motivo. Agora, quando o erro não é um dos
conhecidos, a mensagem mostra o **código técnico exato** entre
parênteses — assim, se algo ainda falhar, me manda o print e eu já sei
exatamente o que verificar, sem precisar adivinhar.

**Suspeita mais provável para os erros de login/Lumi**: no Firebase
Console → Authentication → Sign-in method, confirme que **Anonymous** e
**Email/Password** (e Google, se você usa) estão com o status
"Habilitado". Isso é separado de tudo que já configuramos até aqui.

## 🆕 Atualização — Lumi migrada pra Gemini (gratuito) + correção real de tema no leitor

### IA trocada de Anthropic para Gemini

Migrei a função `askLumi` para usar o **Gemini** (Google) em vez da
Anthropic — é a mesma qualidade de resposta pra este uso, mas o Google AI
Studio emite chave gratuita sem pedir cartão de crédito. Veja o passo a
passo completo (com o link direto pra gerar a chave) em
`functions/README.md`, seção "Passo 0". Resumo:

1. **console.anthropic.com não é mais necessário** — em vez disso, use
   **aistudio.google.com** → Get API key → Create API key.
2. `firebase functions:secrets:set GEMINI_API_KEY` (troca o nome do
   secret — se você já tinha configurado `ANTHROPIC_API_KEY` antes, esse
   fica órfão, sem problema, pode ignorar ou remover).
3. `cd functions && npm install && npm run deploy`

**O plano Blaze do Firebase continua sendo exigido** — isso é sobre
Cloud Functions poderem acessar a internet, não sobre qual IA você
escolhe. O Gemini elimina o custo/cadastro da IA em si; o Blaze continua
sendo pré-requisito técnico do Firebase, com cota gratuita mensal
generosa.

### Bug real corrigido: tema do site vazando pro leitor

Você tinha razão em desconfiar — achei o problema. O painel de
**Ajustes** dentro do leitor (fonte, tamanho, tema, margens) usava as
cores do tema *do site inteiro*, não as cores do tema *da leitura*. Na
prática: se o site estivesse no tema Escuro mas você tivesse escolhido
ler em Sépia, o painel de ajustes aparecia escuro flutuando sobre uma
página sépia — uma mistura visual que não deveria acontecer.

Corrigido: agora esse painel usa exclusivamente as cores do tema de
leitura escolhido (Claro/Papel/Sépia/Escuro), nunca as do tema do site.
Troca de tema de leitura agora também tem uma transição suave (antes
trocava instantaneamente).

Reconfirmando o comportamento esperado: o tema do **site** (ícone de
paleta no cabeçalho, ou Perfil → Aparência) e o tema da **leitura**
(dentro do leitor, ícone de ajustes) são propositalmente independentes
— você pode ter o site em Escuro e ler em Sépia ao mesmo tempo, sem
nenhum vazamento entre os dois agora.

## 🆕 Atualização — histórico da Lumi salvo de verdade + arquitetura da IA documentada

Revisando a lista original de novo, achei uma peça que ainda faltava:
o histórico de conversa com a Lumi nunca era salvo em lugar nenhum —
fechar o painel ou recarregar a página apagava tudo. Corrigido, e
aproveitei para documentar a arquitetura completa da IA como foi pedido.

### Histórico da Lumi agora persiste

- Cada livro tem sua própria conversa salva (`users/{uid}/lumi/{livro}`),
  então perguntar sobre "A Casa dos Espíritos" não mistura com uma
  conversa sobre outro livro.
- Reabrir o painel no mesmo livro retoma de onde parou, mesmo depois de
  fechar o navegador.
- Botão novo de "Limpar conversa" no cabeçalho do painel.
- Só funciona pra contas reais (não anônimas) — sessões anônimas
  continuam efêmeras, como já era o padrão do resto do app.
- **Nova regra do Firestore** (`users/{uid}/lumi/{contextKey}`) —
  publique de novo (Console → Firestore → Regras → colar → Publicar).

### Arquitetura da IA (Lumi) — como funciona hoje

**Backend**: uma Cloud Function (`askLumi`, em `functions/src/index.ts`)
recebe as mensagens da conversa e o contexto do livro atual (título,
autor, capítulo, um trecho de referência), monta um prompt de sistema em
português definindo a personalidade da Lumi, e chama a API da Anthropic
(modelo `claude-sonnet-4-5`, até 600 tokens de resposta) usando o SDK
oficial (`@anthropic-ai/sdk`).

**Segurança da chave de API**: a chave (`ANTHROPIC_API_KEY`) nunca entra
no navegador — fica armazenada como *secret* do Firebase
(`firebase functions:secrets:set ANTHROPIC_API_KEY`), acessível só pela
Cloud Function em execução no servidor. O cliente (navegador) só chama a
function pelo SDK do Firebase (`httpsCallable`), sem nunca ver ou
manipular a chave.

**Comunicação com o modelo**: navegador → `askLumi` (Cloud Function,
autenticação exigida) → API da Anthropic → resposta processada e
devolvida ao navegador. Limites aplicados no backend: máximo de 20
mensagens de contexto e 4000 caracteres por mensagem, pra manter custo e
latência previsíveis.

**Armazenamento do histórico**: Firestore, em
`users/{uid}/lumi/{contextKey}`, um documento por livro (ou "geral" para
conversas sem livro associado), guardando as últimas 30 mensagens. Some
junto com a conta se ela for excluída.

**O que a Lumi já faz hoje**: resumir capítulos, explicar trechos,
responder perguntas sobre o livro atual, recomendar leituras parecidas,
dar contexto histórico/cultural — tudo isso já estava funcional, só
faltava o histórico persistir.

**O que ainda não faz** (fora do escopo desta rodada, pra não inflar o
prompt/custo sem necessidade): criar metas de leitura automaticamente ou
enviar lembretes proativos — hoje a Lumi responde quando você pergunta,
não inicia conversas sozinha. Dá pra evoluir isso numa próxima rodada se
fizer sentido pra você.

---

## 🆕 Atualização — auditoria de responsividade

Última frente da lista original. Sem regra nova do Firestore, sem
dependência nova — só ajustes de CSS/layout.

### Como auditei sem navegador

Sem acesso a um navegador real neste ambiente, revisei sistematicamente
o código de cada página atrás dos padrões que realmente quebram em telas
estreitas: larguras fixas em pixel sem alternativa responsiva, grupos
flex sem `flex-wrap` que deveriam ter, menus suspensos que podem
ultrapassar a borda da tela, e áreas de toque pequenas demais.

### O que encontrei e corrigi

- **Barra de filtro/busca/ordenação da Biblioteca** podia ultrapassar a
  largura da tela em celulares mais estreitos (grupo de busca + ordenação
  sem `flex-wrap` próprio). Agora encolhe e quebra linha corretamente, e
  o rótulo de ordenação vira "Ordenar" (mais curto) abaixo do tablet.
- **Barra de destacar texto no leitor** tinha cantos totalmente
  arredondados (`rounded-full`) que ficavam com aparência quebrada ao
  quebrar em duas linhas num celular estreito — trocado para cantos
  arredondados normais, que ficam corretos em qualquer número de linhas.
- **4 menus suspensos** (conta, tema, ordenação da biblioteca, ações do
  livro) podiam ultrapassar a borda esquerda da tela em aparelhos muito
  estreitos — adicionei um limite baseado na largura da tela em todos
  eles.
- **Botões de ícone do leitor** (voltar, sumário, marcador, IA, ajustes)
  aumentados de 36px para 40px — mais fácil de tocar com precisão.

### O que revisei e já estava correto

Grade de capas da Biblioteca e do Catálogo, categorias de busca,
formulário de login/cadastro, cabeçalho e menu mobile, linhas do
Ranking, grade de conquistas e missões — todos já usavam padrões
responsivos adequados (quebra de linha, larguras flexíveis, truncamento
de texto) sem precisar de ajuste.

## 🆕 Atualização — tema visual em todo o site (Claro/Sépia/Papel/Escuro)

Nenhuma regra nova do Firestore — esse tema é salvo só no navegador
(preferência de aparelho, não da conta), sem precisar de deploy extra
além do site em si.

### O que mudou

Todo o site (Home, Catálogo, Descobrir, Biblioteca, Perfil, Desafios,
Ranking, login) agora respeita 4 temas, não só o leitor:
- **Escuro** — o visual original, continua sendo o padrão.
- **Claro** — fundo quase branco, alto contraste.
- **Sépia** — âmbar aconchegante.
- **Papel** — bege suave, neutro.

Troca disponível em dois lugares: um ícone de paleta no cabeçalho
(acesso rápido em qualquer página) e uma seção "Aparência" na página de
Perfil. A escolha fica salva e é aplicada antes mesmo da página carregar
de novo (sem piscar no tema errado).

**Importante**: o tema do leitor (a tela de leitura em si) continua
sendo uma escolha *separada*, como já era — você pode ler no modo Sépia
mesmo com o resto do site no modo Escuro, por exemplo. Isso é proposital:
apps de leitura de verdade costumam separar "tema do app" de "tema da
leitura".

### Como validei sem poder ver a tela

Não tenho como abrir um navegador de verdade neste ambiente, então em vez
de simplesmente adivinhar as cores, calculei matematicamente o contraste
(fórmula oficial do WCAG) de texto sobre fundo em cada um dos 4 temas
antes de aplicar qualquer valor — todos passam confortavelmente do
mínimo recomendado para leitura confortável. Também revisei o código
inteiro atrás de cores fixas que pudessem quebrar visualmente com a
troca de tema, e não encontrei nenhuma fora do leitor (o site já era bem
construído nesse sentido, usando um sistema de tokens de cor consistente
em vez de valores soltos).

### O que fica para a próxima rodada

Auditoria de responsividade dedicada (celular/tablet/notebook/desktop).

---

## 🆕 Atualização — gamificação completa (nível, conquistas, sequência, missões)

Nenhuma regra nova do Firestore precisa ser publicada desta vez — os
campos novos vivem no mesmo documento `users/{uid}` que já existia.

### Nível e XP

Fórmula de nível progressivo (cada nível pede mais XP que o anterior,
como em RPG). Aparece em **Desafios** com barra de progresso até o
próximo nível.

### Sequência diária (streak)

Abrir um livro ou terminar um capítulo conta como atividade do dia.
Sequência quebra se passar mais de um dia sem atividade; recorde pessoal
fica salvo separado da sequência atual.

### 16 conquistas reais, em 4 categorias

- **Leitura**: 1/5/10/25/50 livros concluídos.
- **Capítulos**: 10/50/150/400 capítulos lidos (nosso proxy pra "páginas",
  já que as fontes de texto não têm paginação real consistente).
- **Sequência**: 3/7/14/30 dias seguidos.
- **Biblioteca**: 5/15/30 livros salvos.

Cada uma calculada ao vivo a partir dos dados reais — não existe estado
"desbloqueado" salvo que possa dessincronizar do progresso de verdade.
Notificação de "conquista desbloqueada" aparece a primeira vez que você
visita Desafios depois de bater uma meta.

### Missões semanais (renovam toda segunda-feira)

- Leia 5 capítulos esta semana
- Ganhe 150 XP esta semana
- Adicione um livro novo esta semana

### O que fica para a próxima rodada

Tema visual estilo Kindle no restante do site (hoje só o leitor tem os 4
modos Claro/Papel/Sépia/Escuro) e auditoria de responsividade dedicada.

---

## 🆕 Atualização — sistema de gamificação completo

Sem mudança de regras do Firestore desta vez — os campos novos vivem no
mesmo documento de perfil que já existia.

### Nível e XP

Fórmula de nível progressivo (cada nível pede mais XP que o anterior).
Aparece com barra de progresso na página **Desafios**.

### Sequência diária (streak)

Abrir um livro ou terminar um capítulo conta como atividade do dia.
Sequência quebra se passar um dia sem atividade; recorde fica salvo
separadamente mesmo se a sequência atual zerar.

### 16 conquistas reais, em 4 categorias

Calculadas ao vivo a partir dos seus dados reais (livros concluídos,
capítulos lidos, sequência, tamanho da biblioteca) — nunca ficam
"destravadas" artificialmente, sempre refletem o estado atual:
- **Leitura**: 1, 5, 10, 25, 50 livros concluídos.
- **Capítulos**: 10, 50, 150, 400 capítulos lidos.
- **Sequência**: 3, 7, 14, 30 dias seguidos.
- **Biblioteca**: 5, 15, 30 livros salvos.

Toast de comemoração aparece automaticamente quando uma conquista nova é
desbloqueada (guardado localmente no navegador, só pra não repetir o
mesmo aviso).

### Missões semanais

3 missões que resetam toda segunda-feira: ler 5 capítulos, ganhar 150 XP,
adicionar 1 livro novo — cada uma com recompensa extra de XP ao completar.

### Navegação

"Desafios" agora está no menu principal (antes só no rodapé).

### O que fica para as próximas rodadas

Tema Kindle no restante do site (Home, Catálogo, Perfil — hoje só o leitor
tem os 4 modos) e auditoria de responsividade dedicada.

---

## 🆕 Atualização — leitor estilo Kindle (temas, destaques, notas, marcadores) + Biblioteca redesenhada

Continuação da rodada anterior (performance + carrossel). Regra nova no
Firestore: `users/{uid}/annotations/{bookId}` — **publique as regras de
novo** (Console → Firestore Database → Regras → colar `firestore.rules` →
Publicar) pra destaques e marcadores funcionarem.

### Leitor: 4 temas de verdade

Antes eram 3 temas (claro/sépia/escuro), e "claro" e "sépia" ficavam
parecidos demais. Agora são 4, visualmente distintos como num Kindle de
verdade:
- **Claro** — branco, alto contraste, leitura de dia.
- **Papel** — bege suave, imita papel/e-ink, menos cansativo que o branco puro.
- **Sépia** — âmbar mais saturado, o clássico "livro antigo".
- **Escuro** — pra leitura noturna.

Seletor novo com amostra de cor real de cada tema, não só ícone.

### Destaques, notas e marcadores

- Toque em qualquer parágrafo → escolha uma de 4 cores pra destacar.
- Com o parágrafo destacado, dá pra adicionar uma anotação de texto livre.
- Marque a página atual com um toque no ícone de marcador no topo — pra
  voltar num ponto específico depois, sem depender só do "continuar de
  onde parou" automático (que continua funcionando igual).
- Painel lateral do Sumário agora tem 3 abas: **Sumário** / **Destaques** /
  **Marcadores** — toque em qualquer destaque ou marcador da lista pra
  pular direto pra ele.
- Tudo sincroniza pela conta (Firestore), então segue disponível em outro
  dispositivo — diferente do texto de EPUBs importados, que é só local.

### Biblioteca redesenhada

Trocado o layout de lista horizontal por uma estante de capas de verdade
(estilo Kindle/Apple Books):
- Grade de capas em destaque, com selo de status sobre a capa (Lendo /
  Quero ler / Concluído) e selo "EPUB local" quando aplicável.
- Passar o mouse mostra a ação principal ("Continuar lendo" ou "Ver
  detalhes") sobre a capa.
- Filtros por status com contagem (Todos · Lendo · Quero ler · Concluído),
  busca por título/autor, e ordenação (recentes / título / autor).
- Menu de ações por livro (mover de status, remover) em vez de um seletor
  sempre visível — mais limpo.
- Skeleton loading (blocos animados) enquanto carrega, em vez de só um
  spinner central.

### O que fica para as próximas rodadas

Gamificação expandida (conquistas, missões, sequência diária), tema visual
estilo Kindle no restante do site (Home, Catálogo, Perfil — hoje só o
leitor tem os 4 modos), e auditoria de responsividade dedicada.

---

## 🆕 Atualização — performance real, carrossel, leitura com mensagens claras

Este pedido original tinha 11 frentes grandes (tema completo estilo
Kindle, gamificação, redesign da Biblioteca, anotações no leitor, etc.).
Nesta rodada eu foquei nos itens de maior impacto e mais bem definidos;
os demais ficam para as próximas rodadas, com o mesmo nível de cuidado.

### Performance — achados concretos, com números

- **`jszip` carregava em toda visita à Biblioteca**, mesmo sem usar EPUB.
  Agora só carrega quando alguém clica em "Adicionar EPUB". Bundle da
  página: **108KB → 8KB**.
- **A imagem da coruja (mascote) tinha 971KB** pra ser exibida a 128px na
  tela. Redimensionei e convertei pra WebP: **971KB → 4,9KB** (99,5%
  menor). Mesma coisa pra imagem do herói (172K→70K) e capa do livro de
  exemplo (47K→18K). ~1,2MB → ~92KB só nesses três arquivos, usados na
  Home, login e painel da IA — ou seja, em praticamente toda navegação.
- **Bug real corrigido**: a capa do livro de exemplo usava um caminho de
  arquivo fixo (`/src/assets/book-1.jpg`) que funciona no ambiente de
  desenvolvimento mas quebra em produção (o Vite renomeia os arquivos no
  build final). Corrigido com import próprio do arquivo.
- Removi 5 imagens que não eram mais usadas por nenhum código.
- Separei as funções de trocar senha/excluir conta num arquivo próprio,
  carregado só na página de perfil.
- Adicionei `fetchPriority="high"` nas imagens de capa (herói) da Home e
  do login — ajuda o navegador a priorizar o carregamento do que aparece
  primeiro na tela.

### Carrossel novo, substituindo a rolagem simples

Criei um componente de carrossel (`components/carousel.tsx`) com setas
laterais (aparecem ao passar o mouse, em telas maiores), arrastar com o
mouse no desktop, toque nativo no celular, rolagem suave com "encaixe" por
item, e gradiente nas bordas indicando que tem mais conteúdo. Já aplicado
em todas as prateleiras horizontais: "Em alta" e "Bestsellers" na Home, e
as 4 prateleiras do Catálogo (Tendências, Bestsellers, categorias,
domínio público).

### Leitura de domínio público — mensagens de erro muito mais claras

Quando a busca do texto falha tanto pela Cloud Function quanto pela busca
direta do navegador (o cenário do seu print anterior, "Failed to fetch"),
a mensagem agora é específica e acionável — por exemplo: *"Não
conseguimos baixar o texto deste livro. Se você administra este site,
publique as Cloud Functions do projeto (veja DEPLOY.md)..."* em vez do
erro técnico cru. Também adicionei um botão **"Tentar novamente"** na
tela de erro, sem precisar navegar pra outra página.

**Importante**: isso melhora a mensagem, mas a causa raiz (o navegador não
conseguir baixar o arquivo de texto direto do Gutenberg por causa de CORS)
só se resolve de verdade publicando as Cloud Functions — isso já foi
detalhado nas atualizações anteriores deste arquivo.

### O que fica para as próximas rodadas

Redesign completo da Biblioteca, tema visual estilo Kindle (Claro/Escuro/
Sépia/Papel) em todo o site, anotações/destaques/marcadores no leitor,
expansão da gamificação (conquistas, missões, sequência diária), e
auditoria de responsividade dedicada.

---

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
