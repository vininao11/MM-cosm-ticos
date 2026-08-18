function initFinanceiro() {
  document.getElementById('fin-periodo').addEventListener('change', renderFinanceiro);
  ViewRenderers.painel = renderPainel;
  ViewRenderers.pendencias = renderPendencias;
  ViewRenderers.financeiro = renderFinanceiro;
  ViewActions.painel = el => {
    el.innerHTML = `<button class="btn btn-primary" id="btn-painel-nova-venda">${icon('plus')} Nova venda</button>`;
    document.getElementById('btn-painel-nova-venda').addEventListener('click', abrirModalNovaVenda);
  };
}

function renderPainel() {
  const db = getDB();
  const mesAtual = todayISO().slice(0, 7);
  const vendasPagasMes = db.vendas.filter(v => v.status === 'pago' && (v.pagoEm || v.data || '').slice(0, 7) === mesAtual);
  const receita = vendasPagasMes.reduce((s, v) => s + v.total, 0);
  const cmv = vendasPagasMes.reduce((s, v) => s + v.itens.reduce((si, it) => si + (it.custo || 0) * it.qtd, 0), 0);
  document.getElementById('kpi-receita-mes').textContent = formatBRL(receita);
  document.getElementById('kpi-lucro-mes').textContent = formatBRL(receita - cmv);

  const pendVendas = db.vendas.filter(v => v.status === 'pendente');
  const pendCompras = db.compras.filter(c => c.status === 'pendente');
  const totalPend = pendVendas.reduce((s, v) => s + v.total, 0) + pendCompras.reduce((s, c) => s + c.total, 0);
  document.getElementById('kpi-pend-total').textContent = formatBRL(totalPend);
  document.getElementById('kpi-estoque-baixo').textContent = db.estoque.filter(p => lowStock(p, db)).length;

  const labels = [], valores = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    labels.push(iso.slice(8, 10) + '/' + iso.slice(5, 7));
    valores.push(db.vendas.filter(v => v.status === 'pago' && v.data === iso).reduce((s, v) => s + v.total, 0));
  }
  renderChart(document.getElementById('painel-chart'), labels, [{ name: 'Vendas', values: valores }]);

  const baixos = db.estoque.filter(p => lowStock(p, db));
  document.getElementById('painel-estoque-baixo').innerHTML = baixos.length
    ? baixos.slice(0, 8).map(p => `<div class="stack-row warn"><span class="rank-dot"></span><span class="stack-name">${escapeHTML(p.nome)}</span><strong>${p.qtd} un.</strong></div>`).join('')
    : '<div class="stack-empty">Nenhum produto abaixo do mínimo</div>';

  const recentes = db.vendas.slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).slice(0, 6);
  document.getElementById('painel-vendas-recentes').innerHTML = recentes.length
    ? recentes.map(v => `<tr><td class="mono">${escapeHTML(v.numero)}</td><td>${formatDateBR(v.data)}</td><td>${escapeHTML(v.cliente || '-')}</td><td class="num">${formatBRL(v.total)}</td><td><span class="badge badge-${v.status}">${v.status === 'pago' ? 'Pago' : 'Pendente'}</span></td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text-faint);padding:24px">Nenhuma venda registrada ainda</td></tr>';

  const contagem = {};
  db.vendas.forEach(v => v.itens.forEach(it => { contagem[it.nome] = (contagem[it.nome] || 0) + it.qtd; }));
  const maisVendidos = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 7);
  document.getElementById('painel-mais-vendidos').innerHTML = maisVendidos.length
    ? maisVendidos.map(([nome, qtd], i) => `<div class="stack-row"><span class="rank-num">${i + 1}</span><span class="stack-name">${escapeHTML(nome)}</span><strong>${qtd} un.</strong></div>`).join('')
    : '<div class="stack-empty">Ainda não há vendas registradas</div>';
}

function renderPendencias() {
  const db = getDB();
  const pendVendas = db.vendas.filter(v => v.status === 'pendente').map(v => ({ tipo: 'venda', id: v.id, numero: v.numero, vencimento: v.vencimento, nome: v.cliente, valor: v.total }));
  const pendCompras = db.compras.filter(c => c.status === 'pendente').map(c => ({ tipo: 'compra', id: c.id, numero: c.numero, vencimento: c.vencimento, nome: c.fornecedor, valor: c.total }));
  const todas = [...pendVendas, ...pendCompras].sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

  const totalReceber = pendVendas.reduce((s, v) => s + v.valor, 0);
  const totalPagar = pendCompras.reduce((s, c) => s + c.valor, 0);
  document.getElementById('pend-kpi-receber').textContent = formatBRL(totalReceber);
  document.getElementById('pend-kpi-pagar').textContent = formatBRL(totalPagar);
  document.getElementById('pend-kpi-saldo').textContent = formatBRL(totalReceber - totalPagar);
  document.getElementById('pend-kpi-saldo-card').classList.toggle('warn', totalReceber - totalPagar < 0);

  const tbody = document.getElementById('pendencias-tbody');
  const empty = document.getElementById('pendencias-empty');
  const scrollWrap = tbody.closest('.table-scroll');
  if (!todas.length) { scrollWrap.style.display = 'none'; empty.hidden = false; }
  else { scrollWrap.style.display = ''; empty.hidden = true; }
  tbody.innerHTML = todas.map(p => `
    <tr>
      <td><span class="badge badge-tipo-${p.tipo}">${p.tipo === 'venda' ? 'A receber' : 'A pagar'}</span></td>
      <td class="mono">${escapeHTML(p.numero)}</td>
      <td>${p.vencimento ? formatDateBR(p.vencimento) : 'Sem prazo'}</td>
      <td>${escapeHTML(p.nome || '-')}</td>
      <td class="num">${formatBRL(p.valor)}</td>
      <td class="row-actions">
        <button class="icon-btn" data-pay="${p.id}" data-tipo="${p.tipo}" title="Marcar como pago">${icon('check')}</button>
        <button class="icon-btn" data-view="${p.id}" data-tipo="${p.tipo}" title="Ver nota">${icon('eye')}</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-pay]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.tipo === 'venda') marcarVendaPaga(btn.dataset.pay); else marcarCompraPaga(btn.dataset.pay);
  }));
  tbody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    const db2 = getDB();
    if (btn.dataset.tipo === 'venda') renderNota(db2.vendas.find(v => v.id === btn.dataset.view), db2);
    else renderNota(db2.compras.find(c => c.id === btn.dataset.view), db2);
  }));
}

function getPeriodoRange(periodo) {
  const hoje = new Date();
  const y = hoje.getFullYear(), m = hoje.getMonth();
  if (periodo === 'mes') return { inicio: new Date(y, m, 1), fim: new Date(y, m + 1, 0) };
  if (periodo === 'mes-passado') return { inicio: new Date(y, m - 1, 1), fim: new Date(y, m, 0) };
  if (periodo === '30d') { const fim = new Date(); const inicio = new Date(); inicio.setDate(inicio.getDate() - 29); return { inicio, fim }; }
  if (periodo === 'ano') return { inicio: new Date(y, 0, 1), fim: new Date(y, 11, 31) };
  return null;
}

function dentroPeriodo(iso, range) {
  if (!range) return true;
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  return d >= range.inicio && d <= range.fim;
}

function renderFinanceiro() {
  const db = getDB();
  const periodo = document.getElementById('fin-periodo').value;
  const range = getPeriodoRange(periodo);
  const vendasPagas = db.vendas.filter(v => v.status === 'pago' && dentroPeriodo(v.pagoEm || v.data, range));
  const comprasPagas = db.compras.filter(c => c.status === 'pago' && dentroPeriodo(c.pagoEm || c.data, range));
  const receita = vendasPagas.reduce((s, v) => s + v.total, 0);
  const cmv = vendasPagas.reduce((s, v) => s + v.itens.reduce((si, it) => si + (it.custo || 0) * it.qtd, 0), 0);
  const comprasTotal = comprasPagas.reduce((s, c) => s + c.total, 0);
  document.getElementById('fin-kpi-receita').textContent = formatBRL(receita);
  document.getElementById('fin-kpi-cmv').textContent = formatBRL(cmv);
  document.getElementById('fin-kpi-lucro').textContent = formatBRL(receita - cmv);
  document.getElementById('fin-kpi-compras').textContent = formatBRL(comprasTotal);

  document.getElementById('fin-resumo').innerHTML = `
    <div class="summary-item"><span>Margem bruta</span><strong>${receita ? Math.round((receita - cmv) / receita * 100) : 0}%</strong></div>
    <div class="summary-item"><span>Ticket médio</span><strong>${vendasPagas.length ? formatBRL(receita / vendasPagas.length) : formatBRL(0)}</strong></div>
    <div class="summary-item"><span>Pedidos pagos</span><strong>${vendasPagas.length}</strong></div>
    <div class="summary-item"><span>Compras pagas</span><strong>${comprasPagas.length}</strong></div>`;

  const buckets = agruparPorPeriodo(vendasPagas, comprasPagas, periodo, range);
  renderChart(document.getElementById('fin-chart'), buckets.labels, [{ name: 'Receita', values: buckets.receita }, { name: 'Compras', values: buckets.compras }]);

  const movimentos = [
    ...vendasPagas.map(v => ({ data: v.pagoEm || v.data, tipo: 'venda', desc: `${v.numero} · ${v.cliente || 'Cliente avulso'}`, valor: v.total })),
    ...comprasPagas.map(c => ({ data: c.pagoEm || c.data, tipo: 'compra', desc: `${c.numero} · ${c.fornecedor || 'Fornecedor'}`, valor: -c.total }))
  ].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const tbody = document.getElementById('fin-tbody');
  const empty = document.getElementById('fin-empty');
  const scrollWrap = tbody.closest('.table-scroll');
  if (!movimentos.length) { scrollWrap.style.display = 'none'; empty.hidden = false; }
  else { scrollWrap.style.display = ''; empty.hidden = true; }
  tbody.innerHTML = movimentos.map(m => `
    <tr>
      <td>${formatDateBR(m.data)}</td>
      <td><span class="badge badge-tipo-${m.tipo}">${m.tipo === 'venda' ? 'Venda' : 'Compra'}</span></td>
      <td>${escapeHTML(m.desc)}</td>
      <td><span class="badge badge-pago">Pago</span></td>
      <td class="num" style="color:${m.valor < 0 ? 'var(--danger)' : 'var(--success)'}">${m.valor < 0 ? '-' : '+'}${formatBRL(Math.abs(m.valor))}</td>
    </tr>`).join('');
}

function nomeMesAbrev(isoMes) {
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return nomes[Number(isoMes.split('-')[1]) - 1];
}

function agruparPorPeriodo(vendas, compras, periodo, range) {
  if (periodo === 'ano' || periodo === 'tudo') {
    let meses;
    if (periodo === 'ano') {
      const y = new Date().getFullYear();
      meses = Array.from({ length: 12 }, (_, m) => `${y}-${String(m + 1).padStart(2, '0')}`);
    } else {
      const base = new Date();
      meses = [];
      for (let i = 11; i >= 0; i--) meses.push(new Date(base.getFullYear(), base.getMonth() - i, 1).toISOString().slice(0, 7));
    }
    const labels = meses.map(nomeMesAbrev);
    const receita = meses.map(m => vendas.filter(v => (v.pagoEm || v.data || '').slice(0, 7) === m).reduce((s, v) => s + v.total, 0));
    const comprasArr = meses.map(m => compras.filter(c => (c.pagoEm || c.data || '').slice(0, 7) === m).reduce((s, c) => s + c.total, 0));
    return { labels, receita, compras: comprasArr };
  }
  const inicio = new Date(range.inicio);
  const fim = new Date(range.fim);
  const dias = [];
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) dias.push(new Date(d).toISOString().slice(0, 10));
  const labels = dias.map(d => d.slice(8, 10) + '/' + d.slice(5, 7));
  const receita = dias.map(d => vendas.filter(v => (v.pagoEm || v.data) === d).reduce((s, v) => s + v.total, 0));
  const comprasArr = dias.map(d => compras.filter(c => (c.pagoEm || c.data) === d).reduce((s, c) => s + c.total, 0));
  return { labels, receita, compras: comprasArr };
}
