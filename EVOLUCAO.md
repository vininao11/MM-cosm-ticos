# M&M Cosméticos — Evolução Premium v2

Branch: `evolucao-premium`

## O que foi implementado

### 🎨 Design System Premium (style.css reescrito)
- Paleta: off-white, marfim, ameixa (#7B2D5B), vinho, grafite, nude/rosé
- Tipografia: Playfair Display (display) + Inter + IBM Plex Mono
- Sidebar escura elegante, cards com sombra suave, KPIs com faixa colorida
- Estados de carregamento, hover, foco visível, `prefers-reduced-motion`
- Responsivo completo (desktop / tablet / mobile com menu hambúrguer)
- Componentes padronizados: botões, badges, chips, tabelas, modais, tabs, switch

### 📷 Código de barras (barcode.js)
- **Leitor físico USB/Bluetooth** (tipo teclado): detecta digitação rápida + Enter globalmente
- **Leitura por câmera**: ZXing via CDN, com debounce anti-duplicação
- Busca produto por código principal ou múltiplos códigos (campo `codigos[]`)
- Validação de checksum EAN-13/EAN-8/UPC-A (informativa)
- Integrado ao PDV e ao cadastro de produtos

### 🛒 PDV · Ponto de Venda (pdv.js — nova view)
- Carrinho com adição por scan, câmera ou seleção manual
- Quantidade editável direto na linha, remoção, validação de estoque
- Formas de pagamento: Dinheiro, PIX, Débito, Crédito à vista, **Crédito parcelado**, A prazo, **Combinado (2 formas)**
- **Parcelamento com juros compostos e ajuste de centavos na última parcela** (validado em testes)
- Vencimentos automáticos mensais com calendário nativo
- Previsão de parcelas em tempo real

### 🧾 Comprovantes premium (app.js)
- Logo da loja configurável, mensagem de agradecimento personalizável
- Mostra parcelas, valor recebido e saldo pendente
- **Impressão/PDF** (media print) e **geração de imagem PNG** via canvas (sem dependências)
- Envio WhatsApp com texto (template personalizado) + imagem via Web Share API, com fallback de download

### 💬 Mensagens personalizáveis (mensagens.js — aba em Configurações)
- 7 modelos editáveis: agradecimento, comprovante, confirmação de pagamento, lembrete de vencimento, parcela pendente, cobrança amigável, promoção
- 10 variáveis dinâmicas `{nome_cliente}`, `{valor_total}`, etc. — clique para inserir
- Preview ao vivo com dados de exemplo, ativação por switch, restauração de padrões

### 📊 Análises / Inteligência Comercial (analises.js — nova view)
- Ranking clientes por valor gasto e por frequência (distintos)
- Produtos mais vendidos (qtd) e que mais geraram receita/lucro
- Ticket médio, novos clientes, clientes inativos (>60 dias)
- Sugestões baseadas em fatos (nunca inventa previsões)
- Exportação CSV

### 🏷️ Catálogo virtual (catalogo.js — nova view)
- Grid de produtos com foto, preço, categoria, estoque
- Busca e filtro por categoria
- Compartilhamento por WhatsApp/Web Share com texto formatado

### 🔐 Outros
- Gestão de usuários com perfis (aba em Configurações)
- Backup JSON exportar/importar/limpar
- Vendas agora exibem "Recebido" vs "Total" e status parcelado
- Recebimento de parcelas individualmente com valor parcial
- Calendários nativos (`input type=date`) em todos os campos de data, formato dd/mm/aaaa na exibição

## Testes executados
- ✅ Sintaxe de todos os 14 arquivos JS validada (`node --check`)
- ✅ Parcelamento: R$100 em 3x = 33,33/33,33/33,34 (soma exata)
- ✅ Parcelamento: R$99,99 em 2x = 49,99/50,00
- ✅ Juros compostos: R$1000 em 12x com 2% a.m. = R$1268,24
- ✅ Vencimentos mensais sequenciais corretos
- ✅ Todos os IDs referenciados no JS existem no HTML

## Configurações pendentes (requerem credenciais/infra)
1. **Backend centralizado (Supabase)**: arquitetura preparada; migrar `localStorage` para Postgres com RLS. Requer projeto Supabase + chaves.
2. **API de consulta de EAN/GTIN**: Open Beauty Facts / Open Food Facts são gratuitos mas com cobertura cosmética limitada. APIs pagas (ex.: BigDataCloud, Barcode Lookup) requerem chave. Hoje o sistema usa base local.
3. **WhatsApp Business API**: para envio automático de texto+mídia, requer número empresarial verificado na Meta (custo por conversa). Hoje usa `wa.me` + Web Share.
4. **Impressora de etiquetas**: módulo preparado conceitualmente; requer integração com impressora térmica.

## Como testar
Abra `index.html` no navegador. Crie o primeiro usuário, cadastre produtos (com códigos de barras), vá em **PDV · Caixa** e escaneie/digite um código.
