const DB_KEY = 'mmg_db_v1';
const ViewRenderers = {};
const ViewActions = {};
let currentView = 'painel';
let notaAtual = null;

function defaultDB() {
  return {
    config: { nome: 'M&M Cosméticos', telefone: '', endereco: '', estoqueMinimo: 3, logo: '', msgAgradecimento: 'Obrigada pela preferência! Volte sempre. 💜', categorias: ['Perfumaria', 'Maquiagem', 'Skincare', 'Cabelo', 'Corpo e Banho', 'Unhas'], contVenda: 0, contCompra: 0, msgTemplates: [] },
    estoque: [],
    vendas: [],
    compras: [],
    clientes: [],
    usuarios: [],
    logs: [],
    cupons: []
  };
}

function normalizeDB(raw) {
  const base = defaultDB();
  const db = raw && typeof raw === 'object' ? raw : base;
  db.config = Object.assign(base.config, db.config || {});
  db.estoque = Array.isArray(db.estoque) ? db.estoque : [];
  db.vendas = Array.isArray(db.vendas) ? db.vendas : [];
  db.compras = Array.isArray(db.compras) ? db.compras : [];
  db.clientes = Array.isArray(db.clientes) ? db.clientes : [];
  db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  db.logs = Array.isArray(db.logs) ? db.logs : [];
  db.cupons = Array.isArray(db.cupons) ? db.cupons : [];
  return db;
}

function getDB() {
  try {
    return normalizeDB(JSON.parse(localStorage.getItem(DB_KEY) || 'null'));
  } catch (e) {
    return defaultDB();
  }
}

function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    toast('Armazenamento cheio. Exporte um backup e libere espaço.', 'error');
    return false;
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nextNumero(db, tipo) {
  const key = tipo === 'venda' ? 'contVenda' : 'contCompra';
  db.config[key] = (db.config[key] || 0) + 1;
  const prefixo = tipo === 'venda' ? 'VD' : 'CP';
  return `${prefixo}-${String(db.config[key]).padStart(4, '0')}`;
}

function formatBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDateBR(iso) {
  if (!iso) return '-';
  const parts = String(iso).split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

function formatDateHora(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
}

function escapeHTML(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function comprimirImagem(file, maxSize = 240) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
        else if (h > maxSize) { w *= maxSize / h; h = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function registrarLog(db, acao, detalhes) {
  const usuario = typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null;
  db.logs.push({
    id: uid(),
    data: new Date().toISOString(),
    usuario: usuario ? `${usuario.nome} ${usuario.sobrenome}` : 'Sistema',
    username: usuario ? usuario.username : '',
    acao,
    detalhes: detalhes || {}
  });
}

function icon(name) {
  const paths = {
    plus: '<path d="M10 4v12M4 10h12"/>',
    edit: '<path d="M13.4 3.6a1.9 1.9 0 0 1 2.7 2.7L7.3 15.1l-3.8 1 1-3.8z"/>',
    trash: '<path d="M4 6h12M8 6V4.6A1.4 1.4 0 0 1 9.4 3.2h1.2A1.4 1.4 0 0 1 12 4.6V6M6.2 6l.6 9.4a1.5 1.5 0 0 0 1.5 1.5h3.4a1.5 1.5 0 0 0 1.5-1.5L13.8 6"/>',
    eye: '<path d="M2 10s3-5.4 8-5.4 8 5.4 8 5.4-3 5.4-8 5.4-8-5.4-8-5.4Z"/><circle cx="10" cy="10" r="2.3"/>',
    check: '<path d="M4 10.5l4 4 8-9"/>',
    menu: '<path d="M3 5h14M3 10h14M3 15h14"/>',
    search: '<circle cx="8.5" cy="8.5" r="5.2"/><path d="m12.4 12.4 4 4"/>',
    download: '<path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 16.5h12"/>',
    mail: '<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="m3.5 5.2 6.5 5.2 6.5-5.2"/>',
    whatsapp: '<path d="M16.7 9.7a6.6 6.6 0 0 1-9.9 5.7L3 16.5l1.1-3.6A6.6 6.6 0 1 1 16.7 9.7Z"/><path d="M7.1 6.9c.2-.5.6-.6 1-.3l.9.8c.3.3.3.6.1.9l-.5.7c.7 1.2 1.6 2 2.8 2.5l.7-.6c.3-.2.7-.2 1 .1l.8.8c.3.4.2.8-.3 1-1 .5-2 .3-3.1-.2-1.8-.8-3.3-2.3-4.1-4.1-.5-1.1-.7-2.1-.3-3.1Z"/>',
  };
  return `<svg viewBox="0 0 20 20" class="icon-sm">${paths[name] || ''}</svg>`;
}

function toast(msg, type) {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : ''}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, 2800);
}

function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

function openNoteModal(html, item) {
  document.getElementById('note-body').innerHTML = html;
  notaAtual = item;
  document.getElementById('btn-whatsapp-nota').hidden = !item || item.type !== 'venda';
  document.getElementById('note-overlay').classList.add('show');
}

function closeNoteModal() {
  document.getElementById('note-overlay').classList.remove('show');
}

function imprimirNotaAtual() {
  const conteudo = document.getElementById('note-body').innerHTML;
  document.getElementById('print-area').innerHTML = conteudo;
  window.print();
}

function enviarNotaWhatsApp() {
  if (!notaAtual) return;
  const item = notaAtual;
  const db = getDB();
  let whats = item.clienteWhatsapp || '';
  if (!whats && item.clienteId) {
    const cliente = db.clientes.find(c => c.id === item.clienteId);
    if (cliente) whats = cliente.whatsapp || '';
  }
  const phone = whats.replace(/\D/g, '');
  if (!phone) { toast('Esse cliente não tem WhatsApp cadastrado.', 'error'); return; }
  const ctx = contextoDaVenda(db, item, item.parcelas ? item.parcelas.find(p => p.status === 'pendente') : null);
  const texto = getMensagemAtiva(db, 'comprovante', ctx) ||
    `Olá${item.cliente ? ', ' + item.cliente : ''}! Segue o comprovante da compra ${item.numero} na ${db.config.nome}. Total: ${formatBRL(item.total)}.`;
  gerarNotaPNGBlob().then(blob => {
    if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'comprovante.png', { type: 'image/png' })] })) {
      const file = new File([blob], `comprovante-${item.numero}.png`, { type: 'image/png' });
      navigator.share({ title: `Comprovante ${item.numero}`, text: texto, files: [file] })
        .then(() => toast('Comprovante e mensagem prontos para envio.', 'success'))
        .catch(() => abrirWhatsApp(phone, texto, blob));
    } else {
      abrirWhatsApp(phone, texto, blob);
    }
  });
}
function abrirWhatsApp(phone, texto, blob) {
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `comprovante-${notaAtual ? notaAtual.numero : 'venda'}.png`;
    a.click();
    toast('Imagem baixada. Anexe-a na conversa do WhatsApp.', 'success');
  }
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank');
}
function gerarNotaPNG() {
  gerarNotaPNGBlob().then(blob => {
    if (!blob) { toast('Não foi possível gerar a imagem.', 'error'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `comprovante-${notaAtual ? notaAtual.numero : 'venda'}.png`;
    a.click();
    toast('Imagem do comprovante baixada.', 'success');
  });
}
function gerarNotaPNGBlob() {
  return new Promise(resolve => {
    if (!notaAtual) return resolve(null);
    const db = getDB();
    const item = notaAtual;
    const W = 720, lineH = 26, pad = 36;
    const rows = [];
    rows.push({ tipo: 'titulo', texto: db.config.nome, size: 30, cor: '#632148' });
    if (db.config.endereco || db.config.telefone) rows.push({ tipo: 'texto', texto: `${db.config.endereco || ''} ${db.config.telefone ? '· ' + db.config.telefone : ''}`.trim(), size: 13, cor: '#6E6573' });
    rows.push({ tipo: 'linha' });
    rows.push({ tipo: 'direita', texto: `${item.numero} · ${formatDateBR(item.data)}`, size: 14, cor: '#2B2430' });
    rows.push({ tipo: 'texto', texto: `${item.type === 'venda' ? 'Cliente' : 'Fornecedor'}: ${item.cliente || item.fornecedor || '-'}`, size: 14, cor: '#2B2430' });
    if (item.pagamento) rows.push({ tipo: 'texto', texto: `Pagamento: ${item.pagamento}`, size: 14, cor: '#2B2430' });
    rows.push({ tipo: 'linha' });
    item.itens.forEach(it => rows.push({ tipo: 'item', nome: it.nome, qtd: it.qtd, valor: it.valor }));
    rows.push({ tipo: 'linha' });
    if (item.desconto) rows.push({ tipo: 'direita', texto: `Desconto: -${formatBRL(item.desconto)}`, size: 14, cor: '#6E6573' });
    rows.push({ tipo: 'direita', texto: `TOTAL: ${formatBRL(item.total)}`, size: 20, cor: '#632148' });
    if (item.parcelas && item.parcelas.length) rows.push({ tipo: 'texto', texto: `Recebido: ${formatBRL(item.valorRecebido || 0)}  ·  Saldo pendente: ${formatBRL(item.saldoPendente || 0)}`, size: 13, cor: '#B8860B' });
    if (db.config.msgAgradecimento) rows.push({ tipo: 'texto', texto: db.config.msgAgradecimento, size: 13, cor: '#6E6573', italic: true });
    rows.push({ tipo: 'texto', texto: 'Comprovante interno — não é documento fiscal.', size: 11, cor: '#A39BA6', italic: true });
    let H = pad * 2;
    rows.forEach(r => { H += r.tipo === 'linha' ? 16 : lineH + (r.size && r.size > 18 ? 6 : 0); });
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFDF9'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#E8DFD2'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
    let y = pad;
    const desenhar = (r) => {
      ctx.textBaseline = 'top';
      if (r.tipo === 'linha') { ctx.strokeStyle = '#D8CCBC'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(pad, y + 6); ctx.lineTo(W - pad, y + 6); ctx.stroke(); ctx.setLineDash([]); y += 16; return; }
      const italic = r.italic ? 'italic ' : '';
      ctx.font = `${italic}${r.size || 14}px Inter, sans-serif`;
      ctx.fillStyle = r.cor || '#2B2430';
      if (r.tipo === 'direita') { ctx.textAlign = 'right'; ctx.fillText(r.texto, W - pad, y); }
      else if (r.tipo === 'item') { ctx.textAlign = 'left'; ctx.fillText(`${r.qtd}x  ${r.nome}`, pad, y); ctx.textAlign = 'right'; ctx.fillText(formatBRL(r.qtd * r.valor), W - pad, y); }
      else { ctx.textAlign = 'left'; ctx.fillText(r.texto, pad, y); }
      y += lineH + (r.size && r.size > 18 ? 6 : 0);
    };
    const finalizar = () => { rows.forEach(desenhar); canvas.toBlob(b => resolve(b), 'image/png'); };
    if (db.config.logo) {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height; const maxW = 120, maxH = 80;
        if (w > maxW) { h *= maxW / w; w = maxW; }
        if (h > maxH) { w *= maxH / h; h = maxH; }
        ctx.drawImage(img, pad, y, w, h); y += h + 10; finalizar();
      };
      img.onerror = finalizar;
      img.src = db.config.logo;
    } else finalizar();
  });
}

function renderNota(item, db) {
  const isVenda = item.type === 'venda';
  const pessoa = isVenda ? item.cliente : item.fornecedor;
  const statusLabel = item.status === 'pago' ? 'PAGO' : item.status === 'parcelado' ? 'PARCELADO' : 'PENDENTE';
  const stampClass = item.status === 'pago' ? 'stamp' : 'stamp stamp-pendente';
  const logoHtml = db.config.logo ? `<img class="note-logo" src="${db.config.logo}" alt="Logo">` : '';
  const agradecimento = db.config.msgAgradecimento ? `<div class="note-foot" style="border-top:none; padding-top:6px; font-style:normal; color:#632148; font-weight:600;">${escapeHTML(db.config.msgAgradecimento)}</div>` : '';
  let parcelasHtml = '';
  if (isVenda && item.parcelas && item.parcelas.length) {
    parcelasHtml = `<div style="margin-top:10px; border-top:1px dashed #D8CCBC; padding-top:8px;">
      <div class="note-row"><span>Total com juros</span><b>${formatBRL(item.totalComJuros || item.total)}</b></div>
      <div class="note-row"><span>Já recebido</span><b>${formatBRL(item.valorRecebido || 0)}</b></div>
      <div class="note-row"><span>Saldo pendente</span><b style="color:#B8860B;">${formatBRL(item.saldoPendente || 0)}</b></div>
      <table class="note-items" style="margin-top:6px;">
        <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead>
        <tbody>${item.parcelas.map(p => `<tr><td>${p.numero}ª</td><td>${formatDateBR(p.vencimento)}</td><td>${formatBRL(p.valor)}</td><td>${p.status === 'pago' ? 'Pago' : 'Pendente'}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }
  let recebidoHtml = '';
  if (isVenda && item.valorRecebido !== undefined) {
    recebidoHtml = `<div class="note-row"><span>Valor recebido</span><b>${formatBRL(item.valorRecebido || 0)}</b></div>
      <div class="note-row"><span>Saldo pendente</span><b style="color:${(item.saldoPendente || 0) > 0 ? '#B8860B' : '#2D8659'};">${formatBRL(item.saldoPendente || 0)}</b></div>`;
  }
  const html = `
    <div class="note-paper">
      <div class="${stampClass}">${statusLabel}</div>
      <div class="note-head">
        <div>
          ${logoHtml}
          <div class="note-store">${escapeHTML(db.config.nome)}</div>
          <div class="note-store-meta">${escapeHTML(db.config.endereco || '')}${db.config.endereco && db.config.telefone ? '<br>' : ''}${escapeHTML(db.config.telefone || '')}</div>
        </div>
        <div class="note-id">
          <strong>${escapeHTML(item.numero)}</strong>
          <span>${isVenda ? 'Comprovante de venda' : 'Nota de compra'} · ${formatDateBR(item.data)}</span>
        </div>
      </div>
      <div class="note-row"><span>${isVenda ? 'Cliente' : 'Fornecedor'}</span><b>${escapeHTML(pessoa || '-')}</b></div>
      ${isVenda ? `<div class="note-row"><span>Forma de pagamento</span><b>${escapeHTML(item.pagamento || '-')}</b></div>` : ''}
      ${item.status === 'pendente' ? `<div class="note-row"><span>Vencimento</span><b>${formatDateBR(item.vencimento)}</b></div>` : ''}
      <table class="note-items">
        <thead><tr><th>Item</th><th>Qtd</th><th>Vl. unit.</th><th>Subtotal</th></tr></thead>
        <tbody>${item.itens.map(it => `<tr><td>${escapeHTML(it.nome)}</td><td>${it.qtd}</td><td>${formatBRL(it.valor)}</td><td>${formatBRL(it.valor * it.qtd)}</td></tr>`).join('')}</tbody>
      </table>
      ${item.desconto ? `<div class="note-row"><span>Desconto</span><b>-${formatBRL(item.desconto)}</b></div>` : ''}
      <div class="note-total"><span>Total</span><strong>${formatBRL(item.total)}</strong></div>
      ${recebidoHtml}
      ${parcelasHtml}
      ${agradecimento}
      <div class="note-foot">Comprovante interno — não é documento fiscal</div>
    </div>`;
  openNoteModal(html, item);
}

function renderChart(container, labels, series) {
  if (!labels.length) {
    container.innerHTML = '<div class="chart-empty">Sem dados suficientes ainda</div>';
    return;
  }
  const w = 640, h = 220, padL = 4, padB = 26, padT = 22;
  const innerW = w - padL - 4;
  const innerH = h - padB - padT;
  const allVals = series.flatMap(s => s.values);
  const max = Math.max(...allVals, 1) * 1.18;
  const groupW = innerW / labels.length;
  const barGap = 5;
  const barW = Math.max(4, (groupW - barGap * (series.length + 1)) / series.length);
  const gradId0 = 'grad-a-' + (container.id || 'c');
  const gradId1 = 'grad-b-' + (container.id || 'c');
  let svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`;
  svg += `<defs>
    <linearGradient id="${gradId0}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B48DF8"/>
      <stop offset="100%" stop-color="#7C6CF0"/>
    </linearGradient>
    <linearGradient id="${gradId1}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9DB4E8"/>
      <stop offset="100%" stop-color="#4E6BB5"/>
    </linearGradient>
  </defs>`;
  svg += `<text class="chart-label" x="${padL}" y="12" text-anchor="start">até ${formatBRL(max)}</text>`;
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = padT + innerH - innerH * f;
    svg += `<line class="chart-axis" x1="${padL}" x2="${w - 4}" y1="${y}" y2="${y}"/>`;
  });
  labels.forEach((label, i) => {
    const gx = padL + i * groupW;
    series.forEach((s, si) => {
      const val = s.values[i] || 0;
      const barH = (val / max) * innerH;
      const x = gx + barGap + si * (barW + barGap);
      const y = padT + innerH - barH;
      const cls = si === 0 ? 'chart-bar' : 'chart-bar-b';
      const fill = si === 0 ? `url(#${gradId0})` : `url(#${gradId1})`;
      svg += `<rect class="${cls}" fill="${fill}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH, 0).toFixed(1)}" rx="4"><title>${escapeHTML(label)} · ${escapeHTML(s.name)}: ${formatBRL(val)}</title></rect>`;
    });
    svg += `<text class="chart-label" x="${(gx + groupW / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle">${escapeHTML(label)}</text>`;
  });
  svg += '</svg>';
  container.innerHTML = svg;
  if (series.length > 1) {
    container.insertAdjacentHTML('beforeend', `<div class="chart-legend">${series.map((s, si) => `<span><i style="background:${si === 0 ? 'var(--accent)' : '#6C8FD9'}"></i>${escapeHTML(s.name)}</span>`).join('')}</div>`);
  }
}

const VIEW_META = {
  painel: ['Painel', 'Resumo geral da loja'],
  pdv: ['PDV · Caixa', 'Ponto de venda com leitor de código de barras'],
  estoque: ['Estoque', 'Produtos e níveis de inventário'],
  vendas: ['Vendas', 'Notas de venda emitidas'],
  clientes: ['Clientes', 'Relacionamento com clientes'],
  compras: ['Compras', 'Entradas de mercadoria no estoque'],
  pendencias: ['Pendências', 'Contas a receber e a pagar'],
  financeiro: ['Financeiro', 'Resultado e fluxo de caixa'],
  analises: ['Análises', 'Inteligência comercial e rankings'],
  catalogo: ['Catálogo', 'Vitrine virtual para compartilhar'],
  relatorios: ['Relatórios', 'Indicadores filtráveis por período'],
  registros: ['Registros', 'Histórico de ações realizadas'],
  config: ['Configurações', 'Loja, mensagens, usuários e dados']
};

function setView(id) {
  currentView = id;
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === id));
  document.querySelectorAll('.view').forEach(sec => sec.classList.toggle('active', sec.id === `view-${id}`));
  const activeView = document.getElementById(`view-${id}`);
  if (activeView) {
    activeView.classList.remove('tab-transition');
    requestAnimationFrame(() => activeView.classList.add('tab-transition'));
  }
  const meta = VIEW_META[id];
  document.getElementById('page-title').textContent = meta[0];
  document.getElementById('page-subtitle').textContent = meta[1];
  const actionsEl = document.getElementById('topbar-actions');
  actionsEl.innerHTML = '';
  if (ViewActions[id]) ViewActions[id](actionsEl);
  if (ViewRenderers[id]) ViewRenderers[id]();
  updatePendenciasBadge();
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('open');
  const mobileToggle = document.getElementById('mobile-toggle');
  if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
}

function refreshCurrentView() {
  if (ViewRenderers[currentView]) ViewRenderers[currentView]();
  updatePendenciasBadge();
  renderBrandMark();
}

function getNotasProximasVencer() {
  const db = getDB();
  const hoje = new Date(todayISO() + 'T00:00:00');
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);
  return [
    ...db.vendas.filter(v => v.status === 'pendente').map(v => ({ ...v, tipo: 'Venda', pessoa: v.cliente })),
    ...db.compras.filter(c => c.status === 'pendente').map(c => ({ ...c, tipo: 'Compra', pessoa: c.fornecedor }))
  ].filter(n => {
    if (!n.vencimento) return false;
    const d = new Date(n.vencimento + 'T00:00:00');
    return d <= limite;
  }).sort((a,b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
}

function renderNotificacoes() {
  const lista = getNotasProximasVencer();
  const count = document.getElementById('notification-count');
  if (count) {
    count.textContent = lista.length;
    count.hidden = lista.length === 0;
  }
  return lista;
}

function abrirNotificacoes() {
  const lista = renderNotificacoes();
  const hoje = todayISO();
  openModal(`<h3>Notificações</h3>
    <p class="panel-desc">${lista.length ? 'Notas vencidas ou com vencimento nos próximos 7 dias.' : 'Tudo em dia. Não há notas próximas do vencimento.'}</p>
    <div class="notification-list">${lista.length ? lista.map(n => {
      const vencida = n.vencimento < hoje;
      return `<div class="notification-item ${vencida ? 'overdue' : ''}">
        <div><strong>${escapeHTML(n.numero)}</strong><span>${escapeHTML(n.tipo)} · ${escapeHTML(n.pessoa || '-')}</span></div>
        <div class="notification-date">${vencida ? 'Vencida' : 'Vence'} em ${formatDateBR(n.vencimento)}<br><b>${formatBRL(n.total)}</b></div>
      </div>`;
    }).join('') : '<div class="stack-empty">Nenhuma pendência de vencimento.</div>'}</div>`);
}

function updatePendenciasBadge() {
  const db = getDB();
  const count = db.vendas.filter(v => (v.status === 'pendente') || (v.status === 'parcelado' && (v.saldoPendente || 0) > 0)).length
    + db.compras.filter(c => c.status === 'pendente').length;
  const badge = document.getElementById('nav-badge-pend');
  badge.hidden = count === 0;
  badge.textContent = count;
  renderNotificacoes();
}

function renderBrandMark() {
  const db = getDB();
  const el = document.getElementById('brand-mark');
  el.innerHTML = db.config.logo ? `<img src="${db.config.logo}" alt="Logo">` : 'M&amp;M';
  document.querySelector('.brand-text strong').textContent = db.config.nome || 'M&M Cosméticos';
}

function renderCategoriaChips() {
  const db = getDB();
  const wrap = document.getElementById('cfg-categorias-chips');
  wrap.innerHTML = db.config.categorias.length
    ? db.config.categorias.map((cat, i) => `<span class="chip">${escapeHTML(cat)}<button data-i="${i}">${icon('trash')}</button></span>`).join('')
    : '<span class="stack-empty">Nenhuma categoria cadastrada</span>';
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const db2 = getDB();
      db2.config.categorias.splice(Number(btn.dataset.i), 1);
      saveDB(db2);
      renderCategoriaChips();
      renderCategoriaOptions();
    });
  });
}

function renderCategoriaOptions() {
  const db = getDB();
  const filtro = document.getElementById('estoque-filtro-categoria');
  if (!filtro) return;
  const current = filtro.value;
  filtro.innerHTML = '<option value="">Todas as categorias</option>' + db.config.categorias.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  filtro.value = current;
}

function adicionarCategoria() {
  const input = document.getElementById('cfg-nova-categoria');
  const val = input.value.trim();
  if (!val) return;
  const db = getDB();
  if (db.config.categorias.some(c => c.toLowerCase() === val.toLowerCase())) {
    toast('Essa categoria já existe', 'error');
    return;
  }
  db.config.categorias.push(val);
  saveDB(db);
  input.value = '';
  renderCategoriaChips();
  renderCategoriaOptions();
  toast('Categoria adicionada');
}

function salvarConfiguracoes() {
  const db = getDB();
  db.config.nome = document.getElementById('cfg-nome-loja').value.trim() || 'M&M Cosméticos';
  db.config.telefone = document.getElementById('cfg-telefone').value.trim();
  db.config.endereco = document.getElementById('cfg-endereco').value.trim();
  db.config.estoqueMinimo = parseNumber(document.getElementById('cfg-estoque-minimo').value) || 1;
  db.config.msgAgradecimento = document.getElementById('cfg-msg-agradecimento').value.trim();
  registrarLog(db, 'Configurações da loja atualizadas', { Loja: db.config.nome });
  saveDB(db);
  renderBrandMark();
  toast('Configurações salvas');
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  comprimirImagem(file, 160).then(dataUrl => {
    const db = getDB();
    db.config.logo = dataUrl;
    saveDB(db);
    renderBrandMark();
    toast('Logo atualizado');
  });
}

function removerLogo() {
  const db = getDB();
  db.config.logo = '';
  saveDB(db);
  renderBrandMark();
  document.getElementById('cfg-logo-input').value = '';
  toast('Logo removido');
}

function applyConfigToUI() {
  const db = getDB();
  document.getElementById('cfg-nome-loja').value = db.config.nome;
  document.getElementById('cfg-telefone').value = db.config.telefone || '';
  document.getElementById('cfg-endereco').value = db.config.endereco || '';
  document.getElementById('cfg-estoque-minimo').value = db.config.estoqueMinimo;
  const msgA = document.getElementById('cfg-msg-agradecimento');
  if (msgA) msgA.value = db.config.msgAgradecimento || '';
  renderBrandMark();
  renderCategoriaChips();
  renderCategoriaOptions();
}

// ---- Gestão de usuários ----
function renderUsuarios() {
  const db = getDB();
  const tbody = document.getElementById('cfg-usuarios-tbody');
  if (!tbody) return;
  tbody.innerHTML = db.usuarios.map(u => `
    <tr>
      <td><strong>${escapeHTML(u.nome)} ${escapeHTML(u.sobrenome)}</strong></td>
      <td class="mono">@${escapeHTML(u.username)}</td>
      <td>${escapeHTML(u.email || '-')}</td>
      <td><span class="badge badge-accent">${u.perfil || 'Administrador'}</span></td>
      <td>${formatDateBR((u.criadoEm || '').split('T')[0])}</td>
      <td class="row-actions">${db.usuarios.length > 1 ? `<button class="icon-btn danger" data-del-user="${u.id}">${icon('trash')}</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Nenhum usuário.</td></tr>';
  tbody.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Excluir este usuário?')) return;
    const db2 = getDB();
    db2.usuarios = db2.usuarios.filter(u => u.id !== b.dataset.delUser);
    saveDB(db2); renderUsuarios(); toast('Usuário excluído.');
  }));
}
function abrirModalNovoUsuario() {
  openModal(`<h3>Novo usuário</h3>
    <div class="form-grid">
      <label class="field"><span>Nome</span><input type="text" id="nu-nome"></label>
      <label class="field"><span>Sobrenome</span><input type="text" id="nu-sobrenome"></label>
      <label class="field"><span>E-mail</span><input type="email" id="nu-email"></label>
      <label class="field"><span>Perfil</span><select id="nu-perfil"><option>Administrador</option><option>Proprietário</option><option>Vendedor</option><option>Suporte</option></select></label>
      <label class="field"><span>Senha</span><input type="password" id="nu-senha"></label>
      <label class="field"><span>Confirmar senha</span><input type="password" id="nu-senha2"></label>
    </div>
    <div class="btn-row"><button class="btn btn-ghost" id="nu-cancelar">Cancelar</button><button class="btn btn-primary" id="nu-salvar">Criar usuário</button></div>`);
  document.getElementById('nu-cancelar').addEventListener('click', closeModal);
  document.getElementById('nu-salvar').addEventListener('click', async () => {
    const nome = document.getElementById('nu-nome').value.trim();
    const sobrenome = document.getElementById('nu-sobrenome').value.trim();
    const email = document.getElementById('nu-email').value.trim();
    const perfil = document.getElementById('nu-perfil').value;
    const senha = document.getElementById('nu-senha').value;
    if (!nome || !sobrenome || senha.length < 4) { toast('Preencha nome, sobrenome e senha (mín. 4 caracteres).', 'error'); return; }
    if (senha !== document.getElementById('nu-senha2').value) { toast('As senhas não coincidem.', 'error'); return; }
    const db = getDB();
    const username = gerarUsernameUnico(db, nome, sobrenome);
    db.usuarios.push({ id: uid(), nome, sobrenome, username, email, perfil, senhaHash: await hashSenha(senha), criadoEm: new Date().toISOString() });
    registrarLog(db, 'Usuário criado', { Usuário: `${nome} ${sobrenome}`, Login: username, Perfil: perfil });
    saveDB(db); closeModal(); renderUsuarios(); toast(`Usuário @${username} criado.`, 'success');
  });
}

function exportarBackup() {
  const db = getDB();
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-mm-cosmeticos-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup exportado');
}

function importarBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = normalizeDB(JSON.parse(ev.target.result));
      saveDB(data);
      applyConfigToUI();
      refreshCurrentView();
      toast('Backup importado com sucesso');
    } catch (err) {
      toast('Arquivo de backup inválido', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function resetarSistema() {
  if (!confirm('Isso vai apagar todos os produtos, vendas, compras e clientes salvos neste navegador. Deseja continuar?')) return;
  const db = getDB();
  db.estoque = []; db.vendas = []; db.compras = []; db.clientes = []; db.cupons = [];
  registrarLog(db, 'Dados do sistema apagados', {});
  saveDB(db);
  refreshCurrentView();
  toast('Dados apagados');
}

function initMobileMenu() {
  const btn = document.getElementById('mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!btn || !sidebar) return;
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });
}

function bindGlobalEvents() {
  initMobileMenu();
  document.getElementById('btn-notificacoes')?.addEventListener('click', abrirNotificacoes);
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  document.querySelectorAll('[data-view-link]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.viewLink)));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.getElementById('note-close').addEventListener('click', closeNoteModal);
  document.getElementById('note-overlay').addEventListener('click', e => { if (e.target.id === 'note-overlay') closeNoteModal(); });
  document.getElementById('btn-imprimir-nota').addEventListener('click', imprimirNotaAtual);
  document.getElementById('btn-png-nota').addEventListener('click', gerarNotaPNG);
  document.getElementById('btn-whatsapp-nota').addEventListener('click', enviarNotaWhatsApp);
  document.getElementById('btn-salvar-config').addEventListener('click', salvarConfiguracoes);
  document.getElementById('cfg-logo-input').addEventListener('change', handleLogoUpload);
  document.getElementById('btn-add-categoria').addEventListener('click', adicionarCategoria);
  document.getElementById('cfg-nova-categoria').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionarCategoria(); } });
  document.getElementById('btn-exportar-backup').addEventListener('click', exportarBackup);
  document.getElementById('cfg-importar-input').addEventListener('change', importarBackup);
  document.getElementById('btn-limpar-dados').addEventListener('click', resetarSistema);
  document.getElementById('btn-limpar-logs')?.addEventListener('click', () => {
    if (!confirm('Limpar todos os registros de atividade?')) return;
    const db = getDB(); db.logs = []; saveDB(db); refreshCurrentView(); toast('Registros limpos.');
  });
  // Tabs de configurações
  document.querySelectorAll('#config-tabs .tab-btn').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('#config-tabs .tab-btn').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.config-tab').forEach(s => s.hidden = true);
    document.getElementById(tab.dataset.tab).hidden = false;
    if (tab.dataset.tab === 'cfg-mensagens') renderMsgTemplates();
    if (tab.dataset.tab === 'cfg-usuarios') renderUsuarios();
  }));
  document.getElementById('btn-novo-usuario')?.addEventListener('click', abrirModalNovoUsuario);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeNoteModal(); Barcode.stopCamera(); } });
}

document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();
  initEstoque();
  initClientes();
  initVendas();
  initCompras();
  initFinanceiro();
  initRegistros();
  initRelatorios();
  initPDV();
  initAnalises();
  initCatalogo();
  initMensagens();
  // Datas padrão nos filtros
  const hoje = todayISO();
  const ini = new Date(); ini.setDate(ini.getDate() - 30);
  ['rel-data-inicio', 'an-data-inicio'].forEach(id => { const el = document.getElementById(id); if (el && !el.value) el.value = ini.toISOString().split('T')[0]; });
  ['rel-data-fim', 'an-data-fim'].forEach(id => { const el = document.getElementById(id); if (el && !el.value) el.value = hoje; });
  renderNotificacoes();
  setInterval(renderNotificacoes, 60000);
  initAuth();
});