const DB_KEY = 'mmg_db_v1';
const ViewRenderers = {};
const ViewActions = {};
let currentView = 'painel';
let notaAtual = null;

function defaultDB() {
  return {
    config: { nome: 'M&M Cosméticos', telefone: '', endereco: '', estoqueMinimo: 3, logo: '', categorias: ['Perfumaria', 'Maquiagem', 'Skincare', 'Cabelo', 'Corpo e Banho', 'Unhas'], contVenda: 0, contCompra: 0 },
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
    menu: '<path d="M3 5h14M3 10h14M3 15h14"/>'
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
  let whats = '';
  if (item.clienteId) {
    const cliente = db.clientes.find(c => c.id === item.clienteId);
    if (cliente) whats = cliente.whatsapp || '';
  }
  const phone = whats.replace(/\D/g, '');
  if (!phone) { toast('Esse cliente não tem WhatsApp cadastrado', 'error'); return; }
  let texto = `Olá${item.cliente ? ', ' + item.cliente : ''}! Segue o resumo do pedido ${item.numero}:\n\n`;
  item.itens.forEach(it => { texto += `- ${it.nome} - ${it.qtd}x ${formatBRL(it.valor)}\n`; });
  texto += `\nTotal: ${formatBRL(item.total)}\n${db.config.nome}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank');
}

function renderNota(item, db) {
  const isVenda = item.type === 'venda';
  const pessoa = isVenda ? item.cliente : item.fornecedor;
  const stampClass = item.status === 'pendente' ? 'stamp stamp-pendente' : 'stamp';
  const stampLabel = item.status === 'pendente' ? 'PENDENTE' : 'PAGO';
  const html = `
    <div class="note-paper">
      <div class="${stampClass}">${stampLabel}</div>
      <div class="note-head">
        <div>
          <div class="note-store">${escapeHTML(db.config.nome)}</div>
          <div class="note-store-meta">${escapeHTML(db.config.endereco || '')}${db.config.endereco && db.config.telefone ? '<br>' : ''}${escapeHTML(db.config.telefone || '')}</div>
        </div>
        <div class="note-id">
          <strong>${escapeHTML(item.numero)}</strong>
          <span>${isVenda ? 'Nota de venda' : 'Nota de compra'} · ${formatDateBR(item.data)}</span>
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
  estoque: ['Estoque', 'Produtos e níveis de inventário'],
  vendas: ['Vendas', 'Notas de venda emitidas'],
  clientes: ['Clientes', 'Relacionamento com clientes'],
  compras: ['Compras', 'Entradas de mercadoria no estoque'],
  pendencias: ['Pendências', 'Contas a receber e a pagar'],
  financeiro: ['Financeiro', 'Resultado da loja com base nas vendas'],
  relatorios: ['Relatórios', 'Indicadores e relatórios filtráveis por período'],
  registros: ['Registros', 'Histórico de ações realizadas no sistema'],
  config: ['Configurações', 'Preferências do sistema']
};

function setView(id) {
  currentView = id;
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === id));
  document.querySelectorAll('.view').forEach(sec => sec.classList.toggle('active', sec.id === `view-${id}`));
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
  const count = db.vendas.filter(v => v.status === 'pendente').length + db.compras.filter(c => c.status === 'pendente').length;
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
  document.getElementById('cfg-telefone').value = db.config.telefone;
  document.getElementById('cfg-endereco').value = db.config.endereco;
  document.getElementById('cfg-estoque-minimo').value = db.config.estoqueMinimo;
  renderBrandMark();
  renderCategoriaChips();
  renderCategoriaOptions();
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
  document.getElementById('btn-fechar-nota').addEventListener('click', closeNoteModal);
  document.getElementById('note-overlay').addEventListener('click', e => { if (e.target.id === 'note-overlay') closeNoteModal(); });
  document.getElementById('btn-imprimir-nota').addEventListener('click', imprimirNotaAtual);
  document.getElementById('btn-whatsapp-nota').addEventListener('click', enviarNotaWhatsApp);
  document.getElementById('detail-close').addEventListener('click', () => document.getElementById('detail-overlay').classList.remove('show'));
  document.getElementById('detail-overlay').addEventListener('click', e => { if (e.target.id === 'detail-overlay') e.currentTarget.classList.remove('show'); });
  document.getElementById('btn-salvar-config').addEventListener('click', salvarConfiguracoes);
  document.getElementById('btn-remover-logo').addEventListener('click', removerLogo);
  document.getElementById('cfg-logo-input').addEventListener('change', handleLogoUpload);
  document.getElementById('btn-add-categoria').addEventListener('click', adicionarCategoria);
  document.getElementById('cfg-nova-categoria').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionarCategoria(); } });
  document.getElementById('btn-exportar-dados').addEventListener('click', exportarBackup);
  document.getElementById('cfg-importar-input').addEventListener('change', importarBackup);
  document.getElementById('btn-reset-sistema').addEventListener('click', resetarSistema);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeNoteModal(); document.getElementById('detail-overlay').classList.remove('show'); } });
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
  renderNotificacoes();
  setInterval(renderNotificacoes, 60000);
  initAuth();
});
