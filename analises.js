/* ============================================================
   analises.js — Inteligência comercial: rankings, frequência,
   produtos mais vendidos, sugestões baseadas em dados reais.
   ============================================================ */
function initAnalises() {
  ViewRenderers.analises = renderAnalises;
  ViewActions.analises = el => { el.innerHTML = ''; };
  document.getElementById('an-data-inicio').addEventListener('change', renderAnalises);
  document.getElementById('an-data-fim').addEventListener('change', renderAnalises);
  document.getElementById('an-exportar').addEventListener('click', exportarAnalisesCSV);
}

function vendasNoPeriodo(db) {
  const ini = document.getElementById('an-data-inicio').value;
  const fim = document.getElementById('an-data-fim').value;
  return db.vendas.filter(v => {
    const d = v.data || '';
    if (ini && d < ini) return false;
    if (fim && d > fim) return false;
    return true;
  });
}

function renderAnalises() {
  const db = getDB();
  const vendas = vendasNoPeriodo(db);
  const pagas = vendas.filter(v => v.status === 'pago' || v.status === 'parcelado');

  // Ticket médio
  const receita = pagas.reduce((s, v) => s + (v.valorRecebido || v.total), 0);
  document.getElementById('an-kpi-ticket').textContent = formatBRL(pagas.length ? receita / pagas.length : 0);
  document.getElementById('an-kpi-ticket-note').textContent = `${pagas.length} venda(s) no período`;

  // Novos clientes (primeira compra no período)
  const clientesPorPrimeiraCompra = {};
  db.vendas.slice().sort((a, b) => (a.data || '').localeCompare(b.data || '')).forEach(v => {
    if (v.clienteId && !clientesPorPrimeiraCompra[v.clienteId]) clientesPorPrimeiraCompra[v.clienteId] = v.data;
  });
  const ini = document.getElementById('an-data-inicio').value || '';
  const novos = Object.values(clientesPorPrimeiraCompra).filter(d => d >= ini).length;
  document.getElementById('an-kpi-novos').textContent = novos;

  // Clientes inativos (>60 dias sem comprar)
  const limite = new Date(); limite.setDate(limite.getDate() - 60);
  const limiteISO = limite.toISOString().split('T')[0];
  const ultimaCompraPorCliente = {};
  db.vendas.forEach(v => {
    if (!v.clienteId) return;
    if (!ultimaCompraPorCliente[v.clienteId] || (v.data || '') > ultimaCompraPorCliente[v.clienteId])
      ultimaCompraPorCliente[v.clienteId] = v.data || '';
  });
  const inativos = Object.values(ultimaCompraPorCliente).filter(d => d < limiteISO).length;
  document.getElementById('an-kpi-inativos').textContent = inativos;

  // Ranking clientes por valor
  const porCliente = {};
  pagas.forEach(v => {
    const chave = v.clienteId || ('avulso:' + v.cliente);
    if (!porCliente[chave]) porCliente[chave] = { nome: v.cliente || 'Avulso', valor: 0, qtd: 0, clienteId: v.clienteId || '' };
    porCliente[chave].valor += (v.valorRecebido || v.total);
    porCliente[chave].qtd += 1;
  });
  const rankingValor = Object.values(porCliente).sort((a, b) => b.valor - a.valor).slice(0, 8);
  document.getElementById('an-ranking-valor').innerHTML = rankingValor.length
    ? rankingValor.map((c, i) => `<div class="stack-item" data-cliente="${c.clienteId}">
        <span class="rank">${i + 1}</span>
        <div class="stack-item-info"><strong>${escapeHTML(c.nome)}</strong><span>${c.qtd} pedido(s) · ticket ${formatBRL(c.valor / c.qtd)}</span></div>
        <span class="stack-item-val">${formatBRL(c.valor)}</span>
      </div>`).join('')
    : '<div class="stack-empty">Sem vendas no período para ranking.</div>';

  // Ranking por frequência
  const rankingFreq = Object.values(porCliente).sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  document.getElementById('an-ranking-freq').innerHTML = rankingFreq.length
    ? rankingFreq.map((c, i) => `<div class="stack-item" data-cliente="${c.clienteId}">
        <span class="rank">${i + 1}</span>
        <div class="stack-item-info"><strong>${escapeHTML(c.nome)}</strong><span>${formatBRL(c.valor)} em compras</span></div>
        <span class="stack-item-val">${c.qtd}x</span>
      </div>`).join('')
    : '<div class="stack-empty">Sem dados suficientes.</div>';

  // Produtos mais vendidos por quantidade e receita
  const porProduto = {};
  pagas.forEach(v => v.itens.forEach(it => {
    const chave = it.id || it.nome;
    if (!porProduto[chave]) porProduto[chave] = { nome: it.nome, qtd: 0, receita: 0, custo: 0 };
    porProduto[chave].qtd += it.qtd;
    porProduto[chave].receita += it.valor * it.qtd;
    porProduto[chave].custo += (it.custo || 0) * it.qtd;
  }));
  const prodList = Object.values(porProduto);
  const prodQtd = prodList.slice().sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  document.getElementById('an-prod-qtd').innerHTML = prodQtd.length
    ? prodQtd.map((p, i) => `<div class="stack-item"><span class="rank">${i + 1}</span>
        <div class="stack-item-info"><strong>${escapeHTML(p.nome)}</strong><span>Receita: ${formatBRL(p.receita)}</span></div>
        <span class="stack-item-val">${p.qtd} un</span></div>`).join('')
    : '<div class="stack-empty">Sem produtos vendidos no período.</div>';
  const prodRec = prodList.slice().sort((a, b) => b.receita - a.receita).slice(0, 8);
  document.getElementById('an-prod-receita').innerHTML = prodRec.length
    ? prodRec.map((p, i) => {
        const lucro = p.receita - p.custo;
        return `<div class="stack-item"><span class="rank">${i + 1}</span>
        <div class="stack-item-info"><strong>${escapeHTML(p.nome)}</strong><span>${p.qtd} un · lucro aprox. ${formatBRL(lucro)}</span></div>
        <span class="stack-item-val">${formatBRL(p.receita)}</span></div>`;
      }).join('')
    : '<div class="stack-empty">Sem dados suficientes.</div>';

  // Sugestões baseadas em fatos
  const sugestoes = [];
  if (inativos > 0) sugestoes.push({ t: `Há ${inativos} cliente(s) sem comprar há mais de 60 dias.`, d: 'Considere enviar uma mensagem de reativação com oferta especial.' });
  const estoqueBaixo = db.estoque.filter(p => lowStock(p, db));
  if (estoqueBaixo.length) sugestoes.push({ t: `${estoqueBaixo.length} produto(s) com estoque baixo.`, d: `Recomenda-se reposição: ${estoqueBaixo.slice(0, 3).map(p => p.nome).join(', ')}${estoqueBaixo.length > 3 ? '...' : ''}.` });
  const semGiro = prodList.filter(p => p.qtd === 0);
  if (db.estoque.length >= 5 && prodList.length < db.estoque.length * 0.5) {
    sugestoes.push({ t: 'Mais da metade dos produtos não vendeu no período.', d: 'Avalie promoções ou liquidez para itens parados no estoque.' });
  }
  if (rankingValor.length >= 3) {
    const top3 = rankingValor.slice(0, 3).reduce((s, c) => s + c.valor, 0);
    const participacao = receita ? (top3 / receita * 100).toFixed(0) : 0;
    sugestoes.push({ t: `Top 3 clientes representam ~${participacao}% da receita do período.`, d: 'Mantenha um relacionamento próximo a esses clientes.' });
  }
  if (!sugestoes.length) sugestoes.push({ t: 'Poucos dados para sugestões.', d: 'Continue registrando vendas para que o sistema gere insights mais precisos.' });
  document.getElementById('an-sugestoes').innerHTML = sugestoes.map(s =>
    `<div class="summary-row"><span><b>💡 ${escapeHTML(s.t)}</b><br><span style="font-size:0.8rem;">${escapeHTML(s.d)}</span></span></div>`).join('');

  // Clique em cliente do ranking abre perfil (se tiver clienteId)
  document.querySelectorAll('#an-ranking-valor [data-cliente], #an-ranking-freq [data-cliente]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.cliente;
      if (id) { setView('clientes'); document.getElementById('clientes-busca').value = ''; renderClientes(); }
    });
  });
}

function exportarAnalisesCSV() {
  const db = getDB();
  const vendas = vendasNoPeriodo(db);
  let csv = 'Nota;Data;Cliente;Itens;Total;Recebido;Saldo;Pagamento;Status\n';
  vendas.forEach(v => {
    csv += `${v.numero};${formatDateBR(v.data)};"${(v.cliente || '').replace(/"/g, '""')}";${v.itens.length};${v.total.toFixed(2).replace('.', ',')};${(v.valorRecebido ?? v.total).toFixed(2).replace('.', ',')};${(v.saldoPendente ?? 0).toFixed(2).replace('.', ',')};"${(v.pagamento || '').replace(/"/g, '""')}";${v.status}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `analises_mm_${todayISO()}.csv`;
  a.click();
  toast('CSV exportado', 'success');
}
