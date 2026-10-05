# Bookverse 2.0 — auditoria e execução

Atualizada: 5 de outubro de 2026
Base examinada: `Douglasmarqs/bookverse-zenith`, `main` em `3e8b1e3`

## Estado do produto encontrado

O Bookverse já é uma aplicação React 19 com TanStack Start/Vite, Firebase Auth, Firestore, Storage, Cloud Functions e armazenamento local via IndexedDB/localStorage. O código existente oferece:

| Área       | Já existe                                                                                        | Lacuna relevante                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Leitura    | Importação privada de EPUB/PDF, leitor de texto, leitor PDF por página, temas, marcações e notas | EPUB 3 completo, posição CFI/equivalente com precisão de trecho, PDF original com texto selecionável, busca e miniaturas |
| Descoberta | Google Books, Open Library e Gutendex/Gutenberg, com cache e fallback em clientes existentes     | Serviço interno único de catálogo, classificação de disponibilidade, busca universal e dados próprios de popularidade    |
| Biblioteca | Estados de leitura, progresso sincronizado, livros privados                                      | Listas personalizadas e recuperação offline abrangente                                                                   |
| Jornada    | Meta anual de livros, XP, sequência e conquistas existentes                                      | Sessões de leitura, metas por tempo/páginas/frequência e estatísticas confiáveis                                         |
| Comunidade | Avaliações próprias, curtidas, perfil e ranking                                                  | Seguir pessoas, atividades, comentários, preferências de compartilhamento                                                |
| Lomi       | Painel e recomendações existentes                                                                | Recomendações explicáveis baseadas em histórico, metas e avaliações reais                                                |
| Plataforma | PWA, regras de acesso por usuário em Firestore/Storage, telas de erro globais                    | Observabilidade de domínio, validação em produção e auditoria completa de acessibilidade                                 |

As regras atuais de Firestore e Storage protegem biblioteca, progresso, preferências, anotações e arquivos privados por usuário. As avaliações têm gravação vinculada ao autor. Essa base deve ser preservada ao criar novas entidades.

## Mudanças desta rodada — etapa 1 em andamento

1. **Progresso e conflito entre dispositivos.** O leitor consulta as posições local e remota, mostra uma escolha quando divergem e evita a gravação silenciosa de uma posição sobre a outra. Gravações remotas usam transação e revisão observada; a fila pendente e o cache novo são vinculados ao UID. A conclusão de capítulos não retrocede ao selecionar uma posição anterior. Posições antigas sem UID exigem escolha explícita antes de serem vinculadas a uma conta.
2. **Posição EPUB.** A posição salva inclui índice de parágrafo, além de capítulo, proporção e hora. Mudança de fonte ou largura tenta restaurar o texto visível. É um âncora de parágrafo, não um CFI nem um deslocamento exato dentro do parágrafo; precisa de teste com livros reais de diferentes diagramações.
3. **Importação.** PDF com extensão correta, mas sem assinatura `%PDF-` ou sem páginas legíveis, é recusado. EPUB limita quantidade de entradas e texto extraído, não carrega imagens externas ou `data:` e só aceita imagens raster incluídas no pacote. Falha ao abrir um livro privado sai do estado de carregamento e mostra erro.
4. **Cache offline.** O service worker agora guarda apenas arquivos de build imutáveis e páginas públicas. Arquivos privados, respostas de API e módulos do ambiente de desenvolvimento não entram no cache. No ambiente de desenvolvimento, o worker antigo é desregistrado para evitar páginas e módulos de versões diferentes.
5. **Catálogo.** Uma prateleira chamada “Bestsellers” usava somente o assunto `bestsellers` da Open Library, sem dados de venda. Ela foi substituída por tendências mensais da fonte e retira títulos já exibidos na semana. Respostas malformadas da Open Library são normalizadas com validação básica.
6. **Qualidade de build.** Foram corrigidos erros TypeScript preexistentes. O lint foi separado da formatação automática e volta a executar; restam avisos de Fast Refresh em componentes UI existentes.
7. **Continuação — PDF por página.** Adicionados ajuste à largura e à página, validação de preferências antigas e limites de canvas (8 milhões de pixels, até 4096 px por dimensão). Cada renderização usa um canvas temporário próprio; apenas a página atual concluída é exibida. Progresso só é gravado após hidratação e renderização, com preservação dos marcadores de conclusão. A sessão do leitor reinicia ao trocar livro ou conta. Navegação por gesto não disputa a rolagem horizontal no zoom; os botões ficam visíveis no rodapé. O cabeçalho usa duas linhas em telas pequenas. A animação respeita redução de movimento.
8. **Ajustes acessíveis e armazenamento indisponível.** O painel PDF usa diálogo modal, título/descrição, ciclo de Tab, Escape e retorno de foco. Controles fechados deixam de participar da navegação. Conflitos fecham os ajustes e bloqueiam navegação até a escolha. Preferências PDF e do leitor toleram armazenamento bloqueado ou cheio; isso mantém a interface utilizável, mas não garante persistência local quando o navegador a impede.
9. **EPUB 2/3 e navegação.** O importador lê o sumário EPUB 3 e o NCX do EPUB 2, preserva níveis aninhados, resolve fragmentos e links entre capítulos e guarda os destinos por parágrafo. Caminhos externos, malformados ou que escapem do arquivo são recusados. A direção RTL é preservada como metadado de texto; layout fixo adaptado gera aviso. Livros antigos não são reindexados automaticamente, preservando os vínculos de progresso e anotações.
10. **Acessibilidade do EPUB.** Sumário e ajustes usam diálogos com título, ciclo de foco, Escape e retorno ao controle de origem. Controles fechados saem da navegação; sliders têm nomes e valores acessíveis. O cabeçalho não desaparece enquanto tem foco. Um ajuste de rolagem pendente do capítulo anterior foi corrigido para não desfazer a navegação a uma nota. Campos de autenticação receberam nomes acessíveis e o botão de mostrar senha pode ser usado pelo teclado.
11. **Privacidade do cache local.** EPUB e PDF agora separam IndexedDB e memória por UID e livro. O armazenamento legado é mantido, mas só é migrado após confirmar no servidor que o arquivo pertence à conta atual. Uma cópia já migrada continua disponível offline. A primeira abertura de um cache legado precisa de conexão; falhas não apagam a cópia antiga. O loader também reinicia imediatamente na troca de conta/livro.
12. **Integração Firebase.** Adicionado modo de emuladores, limitado ao desenvolvimento e ao projeto `demo-bookverse`, com testes reais de Auth, Firestore e Storage. As regras de avaliações agora exigem que o UID do documento corresponda ao autor autenticado. Os textos inventados de livros de demonstração foram retirados: IDs antigos mostram um aviso, preservando biblioteca, progresso e anotações.
13. **Posição dentro de uma página PDF.** O progresso agora inclui a rolagem horizontal e vertical normalizada da página ampliada. A posição volta após recarregar, continua equivalente ao trocar entre mobile e desktop e participa da escolha de conflito entre dispositivos. Ajustar a página inteira temporariamente não apaga o último ponto ampliado; mudar de página começa no canto inicial.
14. **Clássicos com edição verificável.** A prateleira deixou de pesquisar a expressão genérica `classic literature`, que retornava crítica e livros sobre clássicos. Agora consulta IDs verificados do Project Gutenberg, prioriza cinco obras em português e preserva uma ordem editorial estável. Um título só recebe “Ler agora” quando a resposta atual possui texto integral utilizável; respostas malformadas, duplicadas ou sem texto são descartadas. Se a fonte falhar, a prateleira mostra indisponibilidade sem bloquear as demais.
15. **Marcos resilientes à desconexão.** O timeout local foi rastreado até o comando de emuladores, que conectava o cliente à porta de Functions sem iniciar esse serviço. O comando agora inicia Auth, Firestore, Storage e Functions em conjunto. Marcos pendentes são armazenados por UID, deduplicados pela mesma identidade idempotente usada no servidor e reenviados depois de reconexão, recarga ou restauração do perfil. Falhas de autenticação ou validação são removidas; falhas transitórias permanecem na fila, limitada a 50 eventos.

## Verificação realizada

- `npm test`: 31 testes passaram, incluindo fila de marcos, resolução de navegação EPUB, IDs legados, posição ampliada em PDF e seleção verificável de clássicos, além da suíte anterior de progresso, arquivos, catálogo e service worker.
- `npx tsc --noEmit`: passou.
- `npm --prefix functions run build`: passou.
- `npm run lint`: passou com 6 avisos preexistentes de Fast Refresh e nenhum erro.
- `npm run build`: passou após as mudanças de código desta rodada.
- Navegador local: Home examinada em 320, 360, 375, 390, 412, 768, 1024, 1440 e 1920 px; Catálogo em 320, 390, 768, 1024 e 1440 px. Nas larguras examinadas não houve scroll horizontal da página. Login, Descobrir e Catálogo renderizaram. Uma sessão limpa do navegador abriu o Catálogo sem erro de hidratação após a correção do worker.
- PDF local: componente real com PDF de teste gerado de três páginas, em harness fora das rotas de produção e ignorado pelo Git. Larguras 320, 360, 375, 390, 412, 768, 844 (landscape), 1024, 1440 e 1920 px sem overflow horizontal da página; ajuste à largura conferido também com barra de rolagem vertical. Zoom 200% mantém a borda inicial acessível e permite rolagem interna. A posição ampliada de 45,01% horizontal e 64,95% vertical foi restaurada exatamente após recarga e permaneceu equivalente após redimensionar de 390 × 844 para 1000 × 700; avançar à página 2 reiniciou a posição em 0%. Trocas rápidas, cor da página renderizada, preferências após recarga, Escape, retorno/ciclo de foco e armazenamento negado foram verificados sem erros de execução. Evento local de conflito verificou bloqueio de navegação e aplicação da posição escolhida; não representa um teste de comunicação com Firestore.

- `npm run test:integration`: os 4 testes anteriores passaram nos emuladores, cobrindo isolamento de dados/arquivos, retomada em outro cliente, gravação offline seguida de reconexão e autorização/validação de avaliações. Um quinto caso agora chama `recordReadingMilestone` pela Functions emulator e confirma idempotência, mas não foi executado nesta sessão porque o Java 21 não está disponível. Logs esperados de `PERMISSION_DENIED` correspondem às tentativas que o teste exige bloquear.
- Navegador autenticado: cadastro, upload EPUB pela interface, armazenamento privado, abertura em um segundo perfil limpo, restauração de progresso e conflito real de posições via transação Firestore. A escolha da posição da conta foi aplicada ao leitor. Esses testes usam os emuladores, sem contas ou arquivos de produção.
- Importador no navegador: fixtures EPUB 2 e 3 com sumário aninhado, fragmentos, links de ida/volta, exclusão de scripts, direção RTL, aviso de layout fixo e rejeição de ZIP corrompido passaram. São arquivos exclusivos de testes, fora do catálogo e das rotas de produção.
- Cache no navegador: IndexedDB real verificou rejeição de migração sem propriedade confirmada, migração autorizada, recuperação offline, remoção isolada e separação dos caches EPUB/PDF em memória.
- PDF autenticado: importação pela biblioteca de arquivo de três páginas sem camada de texto, geração de capa, upload privado, leitor original em 320 px e restauração da página 2 em um segundo perfil limpo, recuperando o arquivo do Storage. Nenhum erro de execução nesses dois navegadores.
- EPUB pela interface: sumário para notas e retorno ao parágrafo esperado, cancelamento da rolagem obsoleta, Escape, ciclo/retorno de foco, ajustes e nomes dos sliders. Sumário inspecionado visualmente em 320 px; sem erros de execução.

**Limite da verificação:** produção não foi acessada com credenciais. Os emuladores e fixtures não substituem a matriz completa de livros reais e dispositivos físicos. Layout fixo fiel, CSS/semântica EPUB completos, CFI/posição exata no trecho e APIs da Lumi ainda não foram validados. A causa do timeout local dos marcos foi corrigida na configuração e a fila foi coberta por testes unitários; a chamada real da Function ainda precisa do novo teste de integração com Java 21. Etapa 1 permanece em andamento.

## Próxima sequência de execução

### Fechar a etapa 1 — Fundação

- Ampliar a integração para perda de conexão durante operações do leitor; verificar as funções de marcos de leitura e repetir os fluxos em dispositivos físicos.
- Montar corpus de EPUB 2/3, imagens, sumário, RTL e layout fixo; medir a precisão da restauração. Migrar do índice de parágrafo para âncora textual mais precisa ou CFI quando o motor suportar.
- Separar o PDF original do modo de texto extraído sem perder busca/seleção. Ajuste à largura/página e recuperação da posição ampliada foram adicionados ao leitor por imagem; faltam miniaturas e duas páginas em tablets quando apropriado.
- Testar estados de erro/offline e acessibilidade do leitor em mobile, tablet, landscape e teclado. Medir bundles grandes de PDF.js, Firestore e JSZip e carregar somente nas rotas necessárias.

### Etapa 2 — Catálogo

Criar `BookCatalogService` com modelos normalizados, procedência e disponibilidade. Consolidar os clientes existentes antes de acrescentar busca universal, filtros, listas e páginas ricas. Não rotular dados da Open Library como vendas ou popularidade do Bookverse.

### Etapa 3 — Jornada

Criar `ReadingSession` com pausa por inatividade, duração e páginas verificáveis. Derivar metas, sequência e conquistas desses eventos; preservar as metas e marcos já gravados.

### Etapa 4 — Comunidade

Evoluir avaliações e perfis já existentes. Criar permissões de visibilidade, follow e feed leve, com regras e índices antes de expor atividade. Popularidade interna deverá contar leitores únicos e eventos reais, com proteção contra repetição.

### Etapa 5 — Inteligência

Usar biblioteca, histórico, avaliações e metas autorizadas para recomendações da Lomi com justificativa e sem enviar conteúdo privado do livro desnecessariamente.

### Etapa 6 — Apresentação

Refazer landing e narrativa visual com telas reais do produto; otimizar SEO, mídia, animação reduzida e desempenho público depois de os fluxos centrais estarem prontos.

## Decisões de compatibilidade

- Não houve migração destrutiva de coleções, regras de acesso ou arquivos privados.
- As posições antigas do navegador continuam disponíveis para recuperação explícita; elas não são automaticamente atribuídas a outra conta.
- Livros de demonstração com texto inventado foram retirados. Os três IDs antigos continuam reconhecidos com um aviso; os registros existentes não são apagados. `sample-book.ts` mantém apenas reexportação de tipos para compatibilidade interna.
- O leitor de PDF com texto ainda usa o modo de texto refluído existente; trocar isso sem uma migração de progresso perderia o vínculo confiável com as páginas originais.
