function initRelatorios() {
  const inicio = document.getElementById('rel-data-inicio');
  const fim = document.getElementById('rel-data-fim');
  const status = document.getElementById('rel-status');
  if (!inicio) return;
  const hoje = todayISO();
  const primeiroMes = hoje.slice(0, 8) + '01';
  inicio.value = primeiroMes;
  fim.value = hoje;
  [inicio, fim, status].forEach(el => el.addEventListener('change', renderRelatorios));
  document.getElementById('btn-relatorio-csv').addEventListener('click', exportarRelatorioCSV);
  document.getElementById('btn-relatorio-imprimir').addEventListener('click', imprimirRelatorio);
  ViewRenderers.relatorios = renderRelatorios;
}

function getVendasRelatorio() {
  const db = getDB();
  const inicio = document.getElementById('rel-data-inicio').value;
  const fim = document.getElementById('rel-data-fim').value;
  const status = document.getElementById('rel-status').value;
  return db.vendas.filter(v => {
    const data = v.data || '';
    return (!inicio || data >= inicio) && (!fim || data <= fim) && (!status || v.status === status);
  }).sort((a,b) => (a.data || '').localeCompare(b.data || '') || (a.numero || '').localeCompare(b.numero || ''));
}

function renderRelatorios() {
  const lista = getVendasRelatorio();
  const receita = lista.filter(v => v.status === 'pago').reduce((s,v) => s + Number(v.total || 0), 0);
  const cmv = lista.filter(v => v.status === 'pago').reduce((s,v) => s + (v.itens || []).reduce((x,it) => x + Number(it.custo || 0) * Number(it.qtd || 0), 0), 0);
  const itens = lista.reduce((s,v) => s + (v.itens || []).reduce((x,it) => x + Number(it.qtd || 0), 0), 0);
  document.getElementById('rel-kpi-vendas').textContent = lista.length;
  document.getElementById('rel-kpi-receita').textContent = formatBRL(receita);
  document.getElementById('rel-kpi-lucro').textContent = formatBRL(receita - cmv);
  document.getElementById('rel-kpi-itens').textContent = itens;
  const tbody = document.getElementById('rel-tbody');
  const empty = document.getElementById('rel-empty');
  tbody.innerHTML = lista.map(v => `<tr><td>${formatDateBR(v.data)}</td><td class="mono">${escapeHTML(v.numero)}</td><td>${escapeHTML(v.cliente || 'Cliente avulso')}</td><td><span class="badge badge-${v.status}">${v.status === 'pago' ? 'Pago' : 'Pendente'}</span></td><td>${itensVenda(v)}</td><td class="num">${formatBRL(v.total)}</td></tr>`).join('');
  empty.hidden = lista.length > 0;
  const byDay = {};
  lista.forEach(v => { byDay[v.data] = (byDay[v.data] || 0) + (v.status === 'pago' ? Number(v.total || 0) : 0); });
  const keys = Object.keys(byDay).sort();
  renderChart(document.getElementById('rel-chart'), keys.map(k => formatDateBR(k).slice(0,5)), [{name:'Receita',values:keys.map(k=>byDay[k])}]);
  const pend = lista.filter(v => v.status === 'pendente').reduce((s,v)=>s+Number(v.total||0),0);
  document.getElementById('rel-resumo').innerHTML = `
    <div class="summary-row"><span>Vendas emitidas</span><strong>${lista.length}</strong></div>
    <div class="summary-row"><span>Recebido</span><strong>${formatBRL(receita)}</strong></div>
    <div class="summary-row"><span>Em aberto</span><strong>${formatBRL(pend)}</strong></div>
    <div class="summary-row"><span>Lucro bruto</span><strong>${formatBRL(receita-cmv)}</strong></div>
    <div class="summary-row"><span>Ticket médio</span><strong>${formatBRL(lista.length ? lista.reduce((s,v)=>s+Number(v.total||0),0)/lista.length : 0)}</strong></div>`;
}

function itensVenda(v) { return (v.itens || []).reduce((s,it)=>s+Number(it.qtd||0),0); }

function csvCell(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function exportarRelatorioCSV() {
  const lista = getVendasRelatorio();
  if (!lista.length) { toast('Não há dados para exportar', 'error'); return; }
  const linhas = [['Data','Nota','Cliente','Status','Itens','Total']];
  lista.forEach(v => linhas.push([v.data,v.numero,v.cliente || 'Cliente avulso',v.status,itensVenda(v),Number(v.total||0).toFixed(2)]));
  const csv = '\ufeff' + linhas.map(l => l.map(csvCell).join(';')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`relatorio-vendas-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
  toast('Relatório CSV exportado');
}

function imprimirRelatorio() {
  const area = document.getElementById('relatorio-print-area');
  const janela = window.open('', '_blank');
  if (!janela) { toast('Permita pop-ups para imprimir o relatório', 'error'); return; }
  janela.document.write(`<html><head><title>Relatório de vendas</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}h1{margin-bottom:4px}.muted{color:#666}</style></head><body><h1>Relatório de vendas — ${getDB().config.nome}</h1><p class="muted">Período: ${formatDateBR(document.getElementById('rel-data-inicio').value)} a ${formatDateBR(document.getElementById('rel-data-fim').value)}</p>${area.innerHTML}</body></html>`);
  janela.document.close(); janela.focus(); janela.print();
}
