# Testes locais do Bookverse

## Emuladores Firebase

Requisitos: Node compatível com o projeto, Firebase CLI e Java 21 no PATH. O runtime das funções é Node 20; use essa versão para reproduzir o ambiente de execução das funções.

Instale as dependências com `npm ci` e `npm --prefix functions ci`. Em um terminal, execute:

```sh
npm run emulators
```

Esse comando inicia Auth (9099), Firestore (8085), Storage (9199) e Functions (5001), somente em `127.0.0.1`, no projeto `demo-bookverse`. Não usa dados de produção. Os dados são temporários e desaparecem ao encerrar os emuladores.

Em outro terminal:

```sh
npm run test:integration
```

A suíte cria contas isoladas e usa endpoints locais fixos. Falha se os emuladores não estiverem disponíveis. Mensagens de permissão negada são esperadas nos testes que verificam bloqueio de outra conta.

## Interface autenticada

O comando anterior já inclui as Functions. Para preparar esse runtime isoladamente antes de iniciar os emuladores:

```sh
npm --prefix functions ci
npm --prefix functions run build
npm run emulators
```

No PowerShell, inicie a interface:

```powershell
$env:VITE_USE_FIREBASE_EMULATORS = 'true'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8080
```

A flag só tem efeito com `import.meta.env.DEV`. Builds de produção continuam usando a configuração existente, mesmo se a flag estiver definida. Não use credenciais pessoais nesse ambiente. Crie uma conta fictícia pela tela de cadastro. Funções que chamam serviços externos, como a Lumi, precisam de configuração própria e não são cobertas pela suíte local.

Com a página aberta, os testes que dependem de DOMParser e IndexedDB podem ser executados no console do navegador:

```js
await (await import("/tests/integration/epub-browser.mjs")).runEpubChecks();
await (await import("/tests/integration/private-cache-browser.mjs")).runPrivateCacheChecks();
```

`tests/fixtures/create-epub.mjs` gera EPUBs exclusivos para testes. Nenhuma fixture é importada pelas rotas do produto.

### Regressão de navegação EPUB

Importe a fixture pela biblioteca. Abra o sumário, selecione “Notas finais” e clique em “Voltar ao trecho importante”. A página de destino deve conter o parágrafo 31 e continuar nele após a rolagem estabilizar. Repita com teclado e em largura móvel. Escape deve fechar sumário/ajustes e devolver o foco ao botão de origem; Tab deve permanecer dentro do diálogo aberto.

### Contas e dispositivos

Abra o mesmo livro em dois perfis independentes de navegador com a mesma conta. Verifique recuperação da cópia privada e posição. Avance os dois para posições diferentes; o leitor deve pedir uma escolha. Uma conta diferente não deve conseguir abrir esse arquivo, mesmo no navegador que já o armazenou. Caches de versões anteriores só são migrados após confirmação da propriedade no servidor, preservando os registros antigos.

### Regressão da posição em PDF

Importe um PDF de várias páginas, use “Largura da tela”, aumente o zoom e role nos dois eixos. Recarregue a página: o mesmo trecho deve voltar ao visor. Redimensione a janela e confirme que o trecho continua proporcionalmente equivalente. Ao avançar para outra página, a rolagem deve começar no canto inicial. Com o mesmo PDF aberto em dois perfis da mesma conta, posições suficientemente diferentes na mesma página devem abrir a escolha de conflito com os percentuais de rolagem.

### Catálogo de domínio público

Abra `/catalogo` e confira “Clássicos em domínio público”. A seleção deve começar com edições verificadas em português e cada item exibido deve abrir no leitor. Bloqueie temporariamente `gutendex.com`: a prateleira deve informar indisponibilidade, enquanto tendências e gêneros continuam utilizáveis.

### Marcos de leitura e reconexão

Com os quatro emuladores ativos, `npm run test:integration` chama a Function `recordReadingMilestone` duas vezes para o mesmo livro. A primeira resposta deve aceitar o evento; a segunda deve recusá-lo como duplicado, mantendo apenas 5 XP e um livro adicionado. Na interface autenticada, desconecte a rede antes de concluir um capítulo e reconecte em seguida: o marco pendente deve permanecer vinculado à mesma conta e ser reenviado sem duplicar XP.

## Verificações gerais

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Consulte `BOOKVERSE-2.0-AUDIT.md` para resultados e limites de cobertura.
