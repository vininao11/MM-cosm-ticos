let carrinhoVenda = [];

function initVendas() {
  document.getElementById('vendas-busca').addEventListener('input', renderVendas);
  document.getElementById('vendas-filtro-status').addEventListener('change', renderVendas);
  ViewRenderers.vendas = renderVendas;
  ViewActions.vendas = el => {
    el.innerHTML = `<button class="btn btn-primary" id="btn-nova-venda">${icon('plus')} Nova venda</button>`;
    document.getElementById('btn-nova-venda').addEventListener('click', abrirModalNovaVenda);
  };
}

function formVendaHTML(db) {
  const clienteOptions = db.clientes.map(c => `<option value="${c.id}">${escapeHTML(c.nome)}${c.whatsapp ? ' · ' + escapeHTML(c.whatsapp) : ''}</option>`).join('');
  const produtoOptions = db.estoque.filter(p => p.qtd > 0).map(p => `<option value="${p.id}">${escapeHTML(p.nome)} — estoque ${p.qtd} — ${formatBRL(p.venda)}</option>`).join('') || '<option value="">Nenhum produto com estoque</option>';
  return `
    <h3>Nova venda</h3>
    <div class="form-grid">
      <label class="field wide"><span>Cliente</span><select id="f-venda-cliente"><option value="">Cliente avulso</option>${clienteOptions}</select></label>
      <label class="field"><span>Data da venda</span><input type="date" id="f-venda-data" value="${todayISO()}"></label>
      <label class="field"><span>Forma de pagamento</span><select id="f-venda-forma"><option>Pix</option><option>Dinheiro</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Boleto</option></select></label>
      <label class="field"><span>Status</span><select id="f-venda-status"><option value="pago">Pago</option><option value="pendente">Pendente</option></select></label>
      <label class="field" id="f-venda-venc-wrap" hidden><span>Vencimento</span><input type="date" id="f-venda-vencimento"></label>
      <label class="field"><span>Desconto (R$)</span><input type="number" id="f-venda-desconto" min="0" step="0.01" value="0"></label>
    </div>
    <div class="add-item-row">
      <label class="field"><span>Produto</span><select id="f-venda-produto">${produtoOptions}</select></label>
      <label class="field"><span>Qtd</span><input type="number" id="f-venda-qtd" min="1" step="1" value="1"></label>
      <button class="btn btn-outline" id="btn-add-item-venda">${icon('plus')} Adicionar</button>
    </div>
    <table class="cart-table">
      <thead><tr><th>Produto</th><th>Qtd</th><th>Vl. unit.</th><th>Subtotal</th><th></th></tr></thead>
      <tbody id="venda-carrinho-body"></tbody>
      <tfoot><tr><td colspan="3">Total</td><td colspan="2" id="venda-carrinho-total">R$ 0,00</td></tr></tfoot>
    </table>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-finalizar-venda">Emitir nota e finalizar venda</button>
      <button class="btn btn-ghost" id="btn-cancelar-venda">Cancelar</button>
    </div>`;
}

function abrirModalNovaVenda() {
  const db = getDB();
  carrinhoVenda = [];
  openModal(formVendaHTML(db));
  renderCarrinhoVenda();
  document.getElementById('btn-add-item-venda').addEventListener('click', adicionarItemVenda);
  document.getElementById('btn-finalizar-venda').addEventListener('click', finalizarVenda);
  document.getElementById('btn-cancelar-venda').addEventListener('click', closeModal);
  document.getElementById('f-venda-desconto').addEventListener('input', renderCarrinhoVenda);
  document.getElementById('f-venda-status').addEventListener('change', e => {
    document.getElementById('f-venda-venc-wrap').hidden = e.target.value !== 'pendente';
  });
}

function adicionarItemVenda() {
  const db = getDB();
  const produtoId = document.getElementById('f-venda-produto').value;
  const qtd = parseNumber(document.getElementById('f-venda-qtd').value);
  const produto = db.estoque.find(p => p.id === produtoId);
  if (!produto) { toast('Selecione um produto', 'error'); return; }
  if (qtd <= 0) { toast('Quantidade inválida', 'error'); return; }
  const jaNoCarrinho = carrinhoVenda.filter(i => i.id === produtoId).reduce((s, i) => s + i.qtd, 0);
  if (jaNoCarrinho + qtd > produto.qtd) { toast(`Estoque insuficiente. Disponível: ${produto.qtd - jaNoCarrinho}`, 'error'); return; }
  const existente = carrinhoVenda.find(i => i.id === produtoId);
  if (existente) existente.qtd += qtd;
  else carrinhoVenda.push({ id: produtoId, nome: produto.nome, valor: produto.venda, custo: produto.custo, qtd });
  renderCarrinhoVenda();
}

function removerItemVenda(i) {
  carrinhoVenda.splice(i, 1);
  renderCarrinhoVenda();
}

function renderCarrinhoVenda() {
  const body = document.getElementById('venda-carrinho-body');
  body.innerHTML = carrinhoVenda.length
    ? carrinhoVenda.map((it, i) => `<tr><td>${escapeHTML(it.nome)}</td><td>${it.qtd}</td><td class="num">${formatBRL(it.valor)}</td><td class="num">${formatBRL(it.valor * it.qtd)}</td><td><button class="icon-btn danger" data-rm="${i}">${icon('trash')}</button></td></tr>`).join('')
    : `<tr class="cart-empty-row"><td colspan="5">Nenhum item adicionado</td></tr>`;
  const sub = carrinhoVenda.reduce((s, i) => s + i.valor * i.qtd, 0);
  const desconto = parseNumber(document.getElementById('f-venda-desconto') ? document.getElementById('f-venda-desconto').value : 0);
  document.getElementById('venda-carrinho-total').textContent = formatBRL(Math.max(0, sub - desconto));
  body.querySelectorAll('[data-rm]').forEach(btn => btn.addEventListener('click', () => removerItemVenda(Number(btn.dataset.rm))));
}

function finalizarVenda() {
  if (!carrinhoVenda.length) { toast('Adicione ao menos um item', 'error'); return; }
  const status = document.getElementById('f-venda-status').value;
  const vencimento = document.getElementById('f-venda-vencimento').value;
  if (status === 'pendente' && !vencimento) { toast('Informe a data de vencimento', 'error'); return; }
  const db = getDB();
  const sub = carrinhoVenda.reduce((s, i) => s + i.valor * i.qtd, 0);
  const desconto = Math.min(sub, parseNumber(document.getElementById('f-venda-desconto').value));
  const total = sub - desconto;
  const clienteId = document.getElementById('f-venda-cliente').value;
  const cliente = db.clientes.find(c => c.id === clienteId);
  carrinhoVenda.forEach(it => {
    const produto = db.estoque.find(p => p.id === it.id);
    if (produto) produto.qtd -= it.qtd;
  });
  const venda = {
    id: uid(),
    type: 'venda',
    numero: nextNumero(db, 'venda'),
    data: document.getElementById('f-venda-data').value || todayISO(),
    criadoEm: new Date().toISOString(),
    cliente: cliente ? cliente.nome : 'Cliente avulso',
    clienteId: clienteId || '',
    pagamento: document.getElementById('f-venda-forma').value,
    status,
    vencimento: status === 'pendente' ? vencimento : '',
    pagoEm: status === 'pago' ? todayISO() : '',
    desconto,
    total,
    itens: carrinhoVenda.map(it => ({ id: it.id, nome: it.nome, qtd: it.qtd, valor: it.valor, custo: it.custo }))
  };
  db.vendas.push(venda);
  registrarLog(db, 'Venda registrada', { Nota: venda.numero, Cliente: venda.cliente, Itens: venda.itens.length, Total: formatBRL(venda.total), Status: venda.status });
  saveDB(db);
  closeModal();
  refreshCurrentView();
  renderVendas();
  toast('Venda registrada');
  renderNota(venda, db);
}

function marcarVendaPaga(id) {
  const db = getDB();
  const venda = db.vendas.find(v => v.id === id);
  if (!venda) return;
  venda.status = 'pago';
  venda.pagoEm = todayISO();
  registrarLog(db, 'Venda marcada como paga', { Nota: venda.numero, Cliente: venda.cliente, Total: formatBRL(venda.total) });
  saveDB(db);
  refreshCurrentView();
  renderVendas();
  toast('Venda marcada como paga');
}

function excluirVenda(id) {
  if (!confirm('Excluir esta venda? Os itens vendidos voltarão ao estoque.')) return;
  const db = getDB();
  const venda = db.vendas.find(v => v.id === id);
  if (!venda) return;
  venda.itens.forEach(it => {
    const produto = db.estoque.find(p => p.id === it.id);
    if (produto) produto.qtd += it.qtd;
  });
  db.vendas = db.vendas.filter(v => v.id !== id);
  registrarLog(db, 'Venda excluída', { Nota: venda.numero, Cliente: venda.cliente });
  saveDB(db);
  refreshCurrentView();
  renderVendas();
  toast('Venda excluída e estoque atualizado');
}

function filtrarVendas(db) {
  const busca = (document.getElementById('vendas-busca').value || '').toLowerCase();
  const status = document.getElementById('vendas-filtro-status').value;
  return db.vendas.filter(v => (!busca || (v.cliente || '').toLowerCase().includes(busca)) && (!status || v.status === status));
}

function renderVendas() {
  const db = getDB();
  const lista = filtrarVendas(db).slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const tbody = document.getElementById('vendas-tbody');
  const empty = document.getElementById('vendas-empty');
  const scrollWrap = tbody.closest('.table-scroll');
  if (!lista.length) {
    scrollWrap.style.display = 'none';
    empty.hidden = false;
    empty.textContent = db.vendas.length ? 'Nenhuma venda encontrada com esse filtro.' : 'Nenhuma venda lançada ainda. Clique em "Nova venda" para emitir a primeira nota.';
  } else {
    scrollWrap.style.display = '';
    empty.hidden = true;
  }
  tbody.innerHTML = lista.map(v => `
    <tr>
      <td class="mono">${escapeHTML(v.numero)}</td>
      <td>${formatDateBR(v.data)}</td>
      <td>${escapeHTML(v.cliente || '-')}</td>
      <td>${v.itens.length} item${v.itens.length !== 1 ? 's' : ''}</td>
      <td class="num">${formatBRL(v.total)}</td>
      <td>${escapeHTML(v.pagamento || '-')}</td>
      <td><span class="badge badge-${v.status}">${v.status === 'pago' ? 'Pago' : 'Pendente'}</span></td>
      <td class="row-actions">
        ${v.status === 'pendente' ? `<button class="icon-btn" data-pay="${v.id}" title="Marcar como pago">${icon('check')}</button>` : ''}
        <button class="icon-btn" data-view="${v.id}" title="Ver nota">${icon('eye')}</button>
        <button class="icon-btn danger" data-del="${v.id}" title="Excluir">${icon('trash')}</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-pay]').forEach(btn => btn.addEventListener('click', () => marcarVendaPaga(btn.dataset.pay)));
  tbody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => renderNota(db.vendas.find(v => v.id === btn.dataset.view), db)));
  tbody.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => excluirVenda(btn.dataset.del)));
}
