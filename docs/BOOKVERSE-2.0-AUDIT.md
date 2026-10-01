# Bookverse 2.0 — auditoria e execução

Data: 30 de setembro de 2026
Base examinada: `Douglasmarqs/bookverse-zenith`, `main` em `3e8b1e3`

## Estado do produto encontrado

O Bookverse já é uma aplicação React 19 com TanStack Start/Vite, Firebase Auth, Firestore, Storage, Cloud Functions e armazenamento local via IndexedDB/localStorage. O código existente oferece:

| Área | Já existe | Lacuna relevante |
| --- | --- | --- |
| Leitura | Importação privada de EPUB/PDF, leitor de texto, leitor PDF por página, temas, marcações e notas | EPUB 3 completo, posição CFI/equivalente com precisão de trecho, PDF original com texto selecionável, busca e miniaturas |
| Descoberta | Google Books, Open Library e Gutendex/Gutenberg, com cache e fallback em clientes existentes | Serviço interno único de catálogo, classificação de disponibilidade, busca universal e dados próprios de popularidade |
| Biblioteca | Estados de leitura, progresso sincronizado, livros privados | Listas personalizadas e recuperação offline abrangente |
| Jornada | Meta anual de livros, XP, sequência e conquistas existentes | Sessões de leitura, metas por tempo/páginas/frequência e estatísticas confiáveis |
| Comunidade | Avaliações próprias, curtidas, perfil e ranking | Seguir pessoas, atividades, comentários, preferências de compartilhamento |
| Lomi | Painel e recomendações existentes | Recomendações explicáveis baseadas em histórico, metas e avaliações reais |
| Plataforma | PWA, regras de acesso por usuário em Firestore/Storage, telas de erro globais | Testes de integração autenticados, observabilidade de domínio e auditoria completa de acessibilidade |

As regras atuais de Firestore e Storage protegem biblioteca, progresso, preferências, anotações e arquivos privados por usuário. As avaliações têm gravação vinculada ao autor. Essa base deve ser preservada ao criar novas entidades.

## Mudanças desta rodada — etapa 1 em andamento

1. **Progresso e conflito entre dispositivos.** O leitor consulta as posições local e remota, mostra uma escolha quando divergem e evita a gravação silenciosa de uma posição sobre a outra. Gravações remotas usam transação e revisão observada; a fila pendente e o cache novo são vinculados ao UID. A conclusão de capítulos não retrocede ao selecionar uma posição anterior. Posições antigas sem UID exigem escolha explícita antes de serem vinculadas a uma conta.
2. **Posição EPUB.** A posição salva inclui índice de parágrafo, além de capítulo, proporção e hora. Mudança de fonte ou largura tenta restaurar o texto visível. É um âncora de parágrafo, não um CFI nem um deslocamento exato dentro do parágrafo; precisa de teste com livros reais de diferentes diagramações.
3. **Importação.** PDF com extensão correta, mas sem assinatura `%PDF-` ou sem páginas legíveis, é recusado. EPUB limita quantidade de entradas e texto extraído, não carrega imagens externas ou `data:` e só aceita imagens raster incluídas no pacote. Falha ao abrir um livro privado sai do estado de carregamento e mostra erro.
4. **Cache offline.** O service worker agora guarda apenas arquivos de build imutáveis e páginas públicas. Arquivos privados, respostas de API e módulos do ambiente de desenvolvimento não entram no cache. No ambiente de desenvolvimento, o worker antigo é desregistrado para evitar páginas e módulos de versões diferentes.
5. **Catálogo.** Uma prateleira chamada “Bestsellers” usava somente o assunto `bestsellers` da Open Library, sem dados de venda. Ela foi substituída por tendências mensais da fonte e retira títulos já exibidos na semana. Respostas malformadas da Open Library são normalizadas com validação básica.
6. **Qualidade de build.** Foram corrigidos erros TypeScript preexistentes. O lint foi separado da formatação automática e volta a executar; restam avisos de Fast Refresh em componentes UI existentes.

## Verificação realizada

- `npm test`: 11 testes passaram (reconciliação de progresso, recuperação legada, validação de arquivo, normalização do catálogo e política do service worker).
- `npx tsc --noEmit`: passou.
- `npm run lint`: passou com 6 avisos preexistentes de Fast Refresh e nenhum erro.
- `npm run build`: passou após as mudanças de código desta rodada.
- Navegador local: Home examinada em 320, 360, 375, 390, 412, 768, 1024, 1440 e 1920 px; Catálogo em 320, 390, 768, 1024 e 1440 px. Nas larguras examinadas não houve scroll horizontal da página. Login, Descobrir e Catálogo renderizaram. Uma sessão limpa do navegador abriu o Catálogo sem erro de hidratação após a correção do worker.

**Limite da verificação:** o clone local não tem a chave Firebase do deploy. Login, Firestore, Storage, sincronização entre dois dispositivos e leitura privada não puderam ser validados de ponta a ponta no navegador. Os testes unitários não substituem ensaios com o emulador Firebase nem a matriz de arquivos EPUB/PDF solicitada.

## Próxima sequência de execução

### Fechar a etapa 1 — Fundação

- Configurar ambiente de teste Firebase e executar fluxo autenticado em dois navegadores/dispositivos; verificar conflito, escolha, fila offline e regras de segurança.
- Montar corpus de EPUB 2/3, imagens, sumário, RTL e layout fixo; medir a precisão da restauração. Migrar do índice de parágrafo para âncora textual mais precisa ou CFI quando o motor suportar.
- Separar o PDF original do modo de texto extraído sem perder busca/seleção. Adicionar ajuste à largura/página, miniaturas e duas páginas em tablets quando apropriado.
- Corrigir a descoberta de clássicos: a busca genérica `classic literature` retorna livros **sobre** clássicos. Selecionar obras por IDs/edições verificadas e mostrar indisponibilidade real.
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
- Livros de demonstração com texto inventado ainda existem em `sample-book.ts` por compatibilidade com IDs antigos. Eles não devem servir como dados reais em novas telas. Uma retirada precisa tratar entradas antigas da biblioteca antes de apagar esses IDs.
- O leitor de PDF com texto ainda usa o modo de texto refluído existente; trocar isso sem uma migração de progresso perderia o vínculo confiável com as páginas originais.
