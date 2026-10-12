/* ============================================================
   mensagens.js — Modelos de mensagem personalizáveis com
   variáveis dinâmicas e integração WhatsApp.
   ============================================================ */
const MSG_TEMPLATES_DEFAULT = [
  { id: 'agradecimento', nome: 'Agradecimento após a compra', ativo: true,
    texto: 'Olá {nome_cliente}! Obrigada por comprar na {nome_loja}. Seu pedido {numero_venda} no valor de {valor_total} foi registrado. Volte sempre! 💜' },
  { id: 'comprovante', nome: 'Envio do comprovante', ativo: true,
    texto: 'Olá {nome_cliente}! Segue o comprovante da sua compra {numero_venda} na {nome_loja}, no valor de {valor_total}. Qualquer dúvida é só chamar!' },
  { id: 'confirmacao_pagto', nome: 'Confirmação de pagamento', ativo: true,
    texto: 'Olá {nome_cliente}! Recebemos o pagamento da sua compra {numero_venda} ({valor_total}). Obrigada! 💜' },
  { id: 'lembrete_venc', nome: 'Lembrete de vencimento', ativo: true,
    texto: 'Olá {nome_cliente}! Passando para lembrar que a parcela de {valor_parcela} da sua compra {numero_venda} vence em {data_vencimento}. 😉' },
  { id: 'parcela_pendente', nome: 'Aviso de parcela pendente', ativo: true,
    texto: 'Olá {nome_cliente}! Identificamos uma parcela pendente de {valor_parcela} (vencimento {data_vencimento}) referente à compra {numero_venda}. Saldo total pendente: {saldo_pendente}. Podemos ajudar?' },
  { id: 'cobranca', nome: 'Cobrança amigável', ativo: false,
    texto: 'Olá {nome_cliente}! Tudo bem? Notamos que o saldo pendente de {saldo_pendente} da compra {numero_venda} ainda não foi quitado. Em caso de dúvidas, converse com a gente!' },
  { id: 'promocao', nome: 'Divulgação de promoções', ativo: false,
    texto: 'Olá {nome_cliente}! A {nome_loja} está com promoções imperdíveis essa semana. Vem conferir! 💜' }
];

const MSG_VARS = [
  { v: '{nome_cliente}', d: 'Nome do cliente' },
  { v: '{nome_loja}', d: 'Nome da loja' },
  { v: '{numero_venda}', d: 'Número da venda' },
  { v: '{data_venda}', d: 'Data da venda' },
  { v: '{valor_total}', d: 'Valor total' },
  { v: '{forma_pagamento}', d: 'Forma de pagamento' },
  { v: '{quantidade_parcelas}', d: 'Qtd. de parcelas' },
  { v: '{valor_parcela}', d: 'Valor da parcela' },
  { v: '{data_vencimento}', d: 'Data de vencimento' },
  { v: '{saldo_pendente}', d: 'Saldo pendente' }
];

function getMsgTemplates(db) {
  if (!Array.isArray(db.config.msgTemplates) || !db.config.msgTemplates.length) {
    db.config.msgTemplates = JSON.parse(JSON.stringify(MSG_TEMPLATES_DEFAULT));
  }
  return db.config.msgTemplates;
}

function initMensagens() {
  document.getElementById('msg-restaurar').addEventListener('click', () => {
    if (!confirm('Restaurar todos os modelos para o padrão? Suas alterações serão perdidas.')) return;
    const db = getDB();
    db.config.msgTemplates = JSON.parse(JSON.stringify(MSG_TEMPLATES_DEFAULT));
    saveDB(db);
    renderMsgTemplates();
    toast('Modelos padrão restaurados.', 'success');
  });
}

function renderMsgTemplates() {
  const db = getDB();
  const templates = getMsgTemplates(db);
  const wrap = document.getElementById('msg-templates-wrap');
  wrap.innerHTML = templates.map((t, idx) => `
    <div class="template-card">
      <div class="template-card-head">
        <strong>${escapeHTML(t.nome)}</strong>
        <label class="switch"><input type="checkbox" data-msg-ativo="${idx}" ${t.ativo ? 'checked' : ''}><span class="switch-slider"></span></label>
      </div>
      <textarea data-msg-texto="${idx}" rows="3" style="width:100%; font-family:var(--font-mono); font-size:0.8rem;">${escapeHTML(t.texto)}</textarea>
      <div class="var-chips">${MSG_VARS.map(v => `<span class="var-chip" data-var="${v.v}" title="${v.d}">${v.v}</span>`).join('')}</div>
      <div class="msg-preview" id="msg-preview-${idx}">${escapeHTML(aplicarVariaveis(t.texto, exemploContexto()))}</div>
      <div style="text-align:right; margin-top:8px;"><button class="btn btn-outline btn-sm" data-msg-salvar="${idx}">Salvar modelo</button></div>
    </div>`).join('');

  wrap.querySelectorAll('[data-var]').forEach(chip => chip.addEventListener('click', () => {
    const idx = chip.closest('.template-card').querySelector('textarea').dataset.msgTexto;
    const ta = wrap.querySelector(`textarea[data-msg-texto="${idx}"]`);
    const start = ta.selectionStart || ta.value.length;
    ta.value = ta.value.slice(0, start) + chip.dataset.var + ta.value.slice(ta.selectionEnd || start);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + chip.dataset.var.length;
    atualizarPreview(idx);
  }));
  wrap.querySelectorAll('textarea[data-msg-texto]').forEach(ta => ta.addEventListener('input', () => atualizarPreview(ta.dataset.msgTexto)));
  wrap.querySelectorAll('[data-msg-salvar]').forEach(btn => btn.addEventListener('click', () => salvarMsgTemplate(Number(btn.dataset.msgSalvar))));
  wrap.querySelectorAll('[data-msg-ativo]').forEach(cb => cb.addEventListener('change', () => {
    const idx = Number(cb.dataset.msgAtivo);
    const db = getDB();
    getMsgTemplates(db)[idx].ativo = cb.checked;
    saveDB(db);
    toast('Modelo ' + (cb.checked ? 'ativado' : 'desativado') + '.', 'success');
  }));
}

function atualizarPreview(idx) {
  const ta = document.querySelector(`textarea[data-msg-texto="${idx}"]`);
  const prev = document.getElementById(`msg-preview-${idx}`);
  if (ta && prev) prev.textContent = aplicarVariaveis(ta.value, exemploContexto());
}

function salvarMsgTemplate(idx) {
  const db = getDB();
  const t = getMsgTemplates(db)[idx];
  t.texto = document.querySelector(`textarea[data-msg-texto="${idx}"]`).value;
  saveDB(db);
  toast('Modelo "' + t.nome + '" salvo.', 'success');
}

function exemploContexto() {
  return {
    nome_cliente: 'Maria Silva', nome_loja: 'M&M Cosméticos', numero_venda: 'VD-0042',
    data_venda: '12/10/2026', valor_total: 'R$ 189,90', forma_pagamento: 'Cartão de crédito parcelado',
    quantidade_parcelas: '3', valor_parcela: 'R$ 63,30', data_vencimento: '12/11/2026', saldo_pendente: 'R$ 126,60'
  };
}

function aplicarVariaveis(texto, ctx) {
  return String(texto || '').replace(/\{(\w+)\}/g, (m, chave) => {
    const v = ctx[chave];
    return (v === undefined || v === null || v === '') ? '' : String(v);
  });
}

// Monta contexto a partir de uma venda (e parcela opcional)
function contextoDaVenda(db, venda, parcela) {
  return {
    nome_cliente: venda.cliente || 'Cliente',
    nome_loja: db.config.nome,
    numero_venda: venda.numero,
    data_venda: formatDateBR(venda.data),
    valor_total: formatBRL(venda.total),
    forma_pagamento: venda.pagamento || '-',
    quantidade_parcelas: venda.parcelas ? String(venda.parcelas.length) : '',
    valor_parcela: parcela ? formatBRL(parcela.valor) : (venda.parcelas ? formatBRL(venda.parcelas[0].valor) : ''),
    data_vencimento: parcela ? formatDateBR(parcela.vencimento) : (venda.parcelas ? formatDateBR(venda.parcelas[0].vencimento) : formatDateBR(venda.vencimento)),
    saldo_pendente: formatBRL(venda.saldoPendente ?? 0)
  };
}

function getMensagemAtiva(db, id, ctx) {
  const t = getMsgTemplates(db).find(x => x.id === id && x.ativo);
  if (!t) return null;
  return aplicarVariaveis(t.texto, ctx);
}
