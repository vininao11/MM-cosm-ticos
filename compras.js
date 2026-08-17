let carrinhoCompra = [];

function initCompras() {
  document.getElementById('compras-busca').addEventListener('input', renderCompras);
  document.getElementById('compras-filtro-status').addEventListener('change', renderCompras);
  ViewRenderers.compras = renderCompras;
  ViewActions.compras = el => {
    el.innerHTML = `<button class="btn btn-primary" id="btn-nova-compra">${icon('plus')} Nova compra</button>`;
    document.getElementById('btn-nova-compra').addEventListener('click', abrirModalNovaCompra);
  };
}

function produtoOptionsCompra(db) {
  return db.estoque.map(p => `<option value="${p.id}">${escapeHTML(p.nome)} — estoque ${p.qtd}</option>`).join('') + '<option value="__novo__">+ Cadastrar novo produto</option>';
}

function formCompraHTML(db) {
  return `
    <h3>Nova compra</h3>
    <div class="form-grid">
      <label class="field wide"><span>Fornecedor</span><input type="text" id="f-compra-fornecedor" placeholder="Nome do fornecedor"></label>
      <label class="field"><span>Data da compra</span><input type="date" id="f-compra-data" value="${todayISO()}"></label>
      <label class="field"><span>Status</span><select id="f-compra-status"><option value="pago">Pago</option><option value="pendente">Pendente</option></select></label>
      <label class="field" id="f-compra-venc-wrap" hidden><span>Vencimento</span><input type="date" id="f-compra-vencimento"></label>
    </div>
    <div class="add-item-row add-item-row-4">
      <label class="field"><span>Produto</span><select id="f-compra-produto">${produtoOptionsCompra(db)}</select></label>
      <label class="field"><span>Qtd</span><input type="number" id="f-compra-qtd" min="1" step="1" value="1"></label>
      <label class="field"><span>Custo unit. (R$)</span><input type="number" id="f-compra-custo" min="0" step="0.01" placeholder="0,00"></label>
      <button class="btn btn-outline" id="btn-add-item-compra">${icon('plus')} Adicionar</button>
    </div>
    <div class="form-row" id="compra-novo-nome-wrap" hidden>
      <input type="text" id="f-compra-novo-nome" placeholder="Nome do novo produto">
      <select id="f-compra-novo-categoria">${db.config.categorias.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}</select>
    </div>
    <table class="cart-table">
      <thead><tr><th>Produto</th><th>Qtd</th><th>Custo unit.</th><th>Subtotal</th><th></th></tr></thead>
      <tbody id="compra-carrinho-body"></tbody>
      <tfoot><tr><td colspan="3">Total</td><td colspan="2" id="compra-carrinho-total">R$ 0,00</td></tr></tfoot>
    </table>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-finalizar-compra">Registrar compra</button>
      <button class="btn btn-ghost" id="btn-cancelar-compra">Cancelar</button>
    </div>`;
}

function abrirModalNovaCompra() {
  const db = getDB();
  carrinhoCompra = [];
  openModal(formCompraHTML(db));
  renderCarrinhoCompra();
  document.getElementById('btn-add-item-compra').addEventListener('click', adicionarItemCompra);
  document.getElementById('btn-finalizar-compra').addEventListener('click', finalizarCompra);
  document.getElementById('btn-cancelar-compra').addEventListener('click', closeModal);
  document.getElementById('f-compra-status').addEventListener('change', e => {
    document.getElementById('f-compra-venc-wrap').hidden = e.target.value !== 'pendente';
  });
  document.getElementById('f-compra-produto').addEventListener('change', e => {
    const novo = e.target.value === '__novo__';
    document.getElementById('compra-novo-nome-wrap').hidden = !novo;
    if (!novo) {
      const produto = getDB().estoque.find(p => p.id === e.target.value);
      document.getElementById('f-compra-custo').value = produto ? produto.custo || '' : '';
    } else {
      document.getElementById('f-compra-custo').value = '';
    }
  });
}

function adicionarItemCompra() {
  const db = getDB();
  const produtoId = document.getElementById('f-compra-produto').value;
  const qtd = parseNumber(document.getElementById('f-compra-qtd').value);
  const custo = parseNumber(document.getElementById('f-compra-custo').value);
  if (qtd <= 0) { toast('Quantidade inválida', 'error'); return; }
  if (custo <= 0) { toast('Informe o custo unitário', 'error'); return; }
  if (produtoId === '__novo__') {
    const nomeNovo = document.getElementById('f-compra-novo-nome').value.trim();
    if (!nomeNovo) { toast('Informe o nome do novo produto', 'error'); return; }
    carrinhoCompra.push({ id: uid(), nome: nomeNovo, qtd, custo, novo: true, categoria: document.getElementById('f-compra-novo-categoria').value });
    document.getElementById('f-compra-novo-nome').value = '';
  } else {
    const produto = db.estoque.find(p => p.id === produtoId);
    if (!produto) { toast('Selecione um produto', 'error'); return; }
    const existente = carrinhoCompra.find(i => i.id === produto.id);
    if (existente) { existente.qtd += qtd; existente.custo = custo; }
    else carrinhoCompra.push({ id: produto.id, nome: produto.nome, qtd, custo });
  }
  document.getElementById('compra-novo-nome-wrap').hidden = true;
  renderCarrinhoCompra();
}

function removerItemCompra(i) {
  carrinhoCompra.splice(i, 1);
  renderCarrinhoCompra();
}

function renderCarrinhoCompra() {
  const body = document.getElementById('compra-carrinho-body');
  body.innerHTML = carrinhoCompra.length
    ? carrinhoCompra.map((it, i) => `<tr><td>${escapeHTML(it.nome)}${it.novo ? ' <span class="badge badge-pendente">novo</span>' : ''}</td><td>${it.qtd}</td><td class="num">${formatBRL(it.custo)}</td><td class="num">${formatBRL(it.custo * it.qtd)}</td><td><button class="icon-btn danger" data-rm="${i}">${icon('trash')}</button></td></tr>`).join('')
    : `<tr class="cart-empty-row"><td colspan="5">Nenhum item adicionado</td></tr>`;
  document.getElementById('compra-carrinho-total').textContent = formatBRL(carrinhoCompra.reduce((s, i) => s + i.custo * i.qtd, 0));
  body.querySelectorAll('[data-rm]').forEach(btn => btn.addEventListener('click', () => removerItemCompra(Number(btn.dataset.rm))));
}

function finalizarCompra() {
  if (!carrinhoCompra.length) { toast('Adicione ao menos um item', 'error'); return; }
  const status = document.getElementById('f-compra-status').value;
  const vencimento = document.getElementById('f-compra-vencimento').value;
  if (status === 'pendente' && !vencimento) { toast('Informe a data de vencimento', 'error'); return; }
  const db = getDB();
  carrinhoCompra.forEach(it => {
    if (it.novo) {
      db.estoque.push({ id: it.id, nome: it.nome, marca: '', categoria: it.categoria, codigo: '', qtd: it.qtd, minimo: db.config.estoqueMinimo, custo: it.custo, venda: 0, imagem: '', criadoEm: new Date().toISOString() });
    } else {
      const produto = db.estoque.find(p => p.id === it.id);
      if (produto) { produto.qtd += it.qtd; produto.custo = it.custo; }
    }
  });
  const total = carrinhoCompra.reduce((s, i) => s + i.custo * i.qtd, 0);
  const compra = {
    id: uid(),
    type: 'compra',
    numero: nextNumero(db, 'compra'),
    data: document.getElementById('f-compra-data').value || todayISO(),
    criadoEm: new Date().toISOString(),
    fornecedor: document.getElementById('f-compra-fornecedor').value.trim() || 'Fornecedor não identificado',
    status,
    vencimento: status === 'pendente' ? vencimento : '',
    pagoEm: status === 'pago' ? todayISO() : '',
    total,
    itens: carrinhoCompra.map(it => ({ id: it.id, nome: it.nome, qtd: it.qtd, valor: it.custo, custo: it.custo }))
  };
  db.compras.push(compra);
  registrarLog(db, 'Compra registrada', { Nota: compra.numero, Fornecedor: compra.fornecedor, Itens: compra.itens.length, Total: formatBRL(compra.total), Status: compra.status });
  saveDB(db);
  closeModal();
  refreshCurrentView();
  renderCompras();
  toast('Compra registrada e estoque atualizado');
  renderNota(compra, db);
}

function marcarCompraPaga(id) {
  const db = getDB();
  const compra = db.compras.find(c => c.id === id);
  if (!compra) return;
  compra.status = 'pago';
  compra.pagoEm = todayISO();
  registrarLog(db, 'Compra marcada como paga', { Nota: compra.numero, Fornecedor: compra.fornecedor, Total: formatBRL(compra.total) });
  saveDB(db);
  refreshCurrentView();
  renderCompras();
  toast('Compra marcada como paga');
}

function excluirCompra(id) {
  if (!confirm('Excluir esta compra? A quantidade recebida será removida do estoque.')) return;
  const db = getDB();
  const compra = db.compras.find(c => c.id === id);
  if (!compra) return;
  compra.itens.forEach(it => {
    const produto = db.estoque.find(p => p.id === it.id);
    if (produto) produto.qtd = Math.max(0, produto.qtd - it.qtd);
  });
  db.compras = db.compras.filter(c => c.id !== id);
  registrarLog(db, 'Compra excluída', { Nota: compra.numero, Fornecedor: compra.fornecedor });
  saveDB(db);
  refreshCurrentView();
  renderCompras();
  toast('Compra excluída e estoque ajustado');
}

function filtrarCompras(db) {
  const busca = (document.getElementById('compras-busca').value || '').toLowerCase();
  const status = document.getElementById('compras-filtro-status').value;
  return db.compras.filter(c => (!busca || (c.fornecedor || '').toLowerCase().includes(busca)) && (!status || c.status === status));
}

function renderCompras() {
  const db = getDB();
  const lista = filtrarCompras(db).slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const tbody = document.getElementById('compras-tbody');
  const empty = document.getElementById('compras-empty');
  const scrollWrap = tbody.closest('.table-scroll');
  if (!lista.length) {
    scrollWrap.style.display = 'none';
    empty.hidden = false;
    empty.textContent = db.compras.length ? 'Nenhuma compra encontrada com esse filtro.' : 'Nenhuma compra registrada ainda. Lance uma compra para dar entrada no estoque.';
  } else {
    scrollWrap.style.display = '';
    empty.hidden = true;
  }
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td class="mono">${escapeHTML(c.numero)}</td>
      <td>${formatDateBR(c.data)}</td>
      <td>${escapeHTML(c.fornecedor || '-')}</td>
      <td>${c.itens.length} item${c.itens.length !== 1 ? 's' : ''}</td>
      <td class="num">${formatBRL(c.total)}</td>
      <td><span class="badge badge-${c.status}">${c.status === 'pago' ? 'Pago' : 'Pendente'}</span></td>
      <td class="row-actions">
        ${c.status === 'pendente' ? `<button class="icon-btn" data-pay="${c.id}" title="Marcar como pago">${icon('check')}</button>` : ''}
        <button class="icon-btn" data-view="${c.id}" title="Ver nota">${icon('eye')}</button>
        <button class="icon-btn danger" data-del="${c.id}" title="Excluir">${icon('trash')}</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-pay]').forEach(btn => btn.addEventListener('click', () => marcarCompraPaga(btn.dataset.pay)));
  tbody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => renderNota(db.compras.find(c => c.id === btn.dataset.view), db)));
  tbody.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => excluirCompra(btn.dataset.del)));
}
