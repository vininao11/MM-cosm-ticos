/* ============================================================
   pdv.js — Ponto de Venda com código de barras, parcelamento
   e pagamentos combinados.
   ============================================================ */
let carrinhoPDV = [];

// ---- Utilidades de data ----
function somarMeses(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  // Evita transbordar dia (ex.: 31/01 + 1 mês = 03/03). Ajusta para último dia do mês.
  const ultDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  if (dt.getDate() !== d) dt.setDate(ultDia);
  return dt.toISOString().split('T')[0];
}

// ---- Cálculo de parcelas com ajuste de centavos na última ----
function calcularParcelas(total, nParcelas, jurosMensaisPct, primeiroVencimento) {
  const juros = Number(jurosMensaisPct) || 0;
  let valorComJuros = total;
  if (juros > 0) {
    // Montante: M = C * (1+i)^n
    valorComJuros = total * Math.pow(1 + juros / 100, nParcelas);
  }
  const base = Math.floor((valorComJuros / nParcelas) * 100) / 100;
  const parcelas = [];
  let somado = 0;
  for (let i = 0; i < nParcelas; i++) {
    const isLast = i === nParcelas - 1;
    const valor = isLast ? Math.round((valorComJuros - somado) * 100) / 100 : base;
    somado += valor;
    parcelas.push({
      id: uid(),
      numero: i + 1,
      vencimento: somarMeses(primeiroVencimento, i),
      valor: Math.round(valor * 100) / 100,
      status: 'pendente',
      pagoEm: '',
      recebido: 0
    });
  }
  return { parcelas, valorTotal: Math.round(somado * 100) / 100 };
}

function renderPreviewParcelas() {
  const wrap = document.getElementById('pdv-parcelas-preview');
  if (!wrap) return;
  const total = pdvTotalAtual();
  if (total <= 0) { wrap.innerHTML = '<div class="stack-empty">Adicione itens para ver as parcelas.</div>'; return; }
  const n = Number(document.getElementById('pdv-n-parcelas').value) || 1;
  const juros = parseNumber(document.getElementById('pdv-juros').value);
  const primeiro = document.getElementById('pdv-primeiro-venc').value || todayISO();
  const { parcelas, valorTotal } = calcularParcelas(total, n, juros, primeiro);
  wrap.innerHTML = parcelas.map(p => `
    <div class="parcela-item">
      <span><b>${p.numero}ª</b> · ${formatDateBR(p.vencimento)}</span>
      <b>${formatBRL(p.valor)}</b>
    </div>`).join('') +
    `<div class="parcela-item" style="border-top:1px solid var(--border-strong); margin-top:4px; padding-top:8px;"><span><b>Total com juros</b></span><b>${formatBRL(valorTotal)}</b></div>`;
}

function pdvSubtotal() { return carrinhoPDV.reduce((s, i) => s + i.valor * i.qtd, 0); }
function pdvTotalAtual() {
  const sub = pdvSubtotal();
  const desc = Math.min(sub, parseNumber(document.getElementById('pdv-desconto') ? document.getElementById('pdv-desconto').value : 0));
  return Math.max(0, sub - desc);
}

function initPDV() {
  ViewRenderers.pdv = renderPDV;
  ViewActions.pdv = el => { el.innerHTML = ''; };

  // Leitor físico global — adiciona ao carrinho do PDV quando a view está ativa
  Barcode.enablePhysicalScanner(code => {
    if (currentView !== 'pdv') return;
    adicionarPorCodigo(code);
  });

  document.getElementById('pdv-codigo').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); adicionarPorCodigo(e.target.value); e.target.value = ''; }
  });
  document.getElementById('pdv-add').addEventListener('click', () => {
    const id = document.getElementById('pdv-produto').value;
    const qtd = parseNumber(document.getElementById('pdv-qtd').value);
    adicionarItemPDV(id, qtd);
    document.getElementById('pdv-qtd').value = 1;
  });
  document.getElementById('pdv-limpar').addEventListener('click', () => { carrinhoPDV = []; renderPDV(); });
  document.getElementById('pdv-cancelar').addEventListener('click', () => { carrinhoPDV = []; renderPDV(); });
  document.getElementById('pdv-finalizar').addEventListener('click', finalizarPDV);
  document.getElementById('pdv-desconto').addEventListener('input', atualizarTotaisPDV);
  document.getElementById('pdv-forma').addEventListener('change', onFormaChange);
  ['pdv-n-parcelas', 'pdv-juros', 'pdv-primeiro-venc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderPreviewParcelas);
  });
  document.getElementById('pdv-valor1').addEventListener('input', () => {
    const total = pdvTotalAtual();
    const v1 = Math.min(total, parseNumber(document.getElementById('pdv-valor1').value));
    document.getElementById('pdv-valor2').value = (total - v1).toFixed(2);
  });
  document.getElementById('pdv-btn-camera').addEventListener('click', async () => {
    const wrap = document.getElementById('pdv-camera-wrap');
    const video = document.getElementById('barcode-video');
    wrap.hidden = false;
    document.getElementById('pdv-btn-camera').hidden = true;
    document.getElementById('pdv-btn-camera-stop').hidden = false;
    document.getElementById('pdv-scan-box').classList.add('active');
    const r = await Barcode.startCamera(video, code => {
      adicionarPorCodigo(code);
    });
    if (!r.ok) {
      toast(r.erro || 'Não foi possível ligar a câmera.', 'error');
      wrap.hidden = true;
      document.getElementById('pdv-btn-camera').hidden = false;
      document.getElementById('pdv-btn-camera-stop').hidden = true;
      document.getElementById('pdv-scan-box').classList.remove('active');
    }
  });
  document.getElementById('pdv-btn-camera-stop').addEventListener('click', () => {
    Barcode.stopCamera();
    document.getElementById('pdv-camera-wrap').hidden = true;
    document.getElementById('pdv-btn-camera').hidden = false;
    document.getElementById('pdv-btn-camera-stop').hidden = true;
    document.getElementById('pdv-scan-box').classList.remove('active');
  });
}

function adicionarPorCodigo(code) {
  const db = getDB();
  const produto = Barcode.lookupProduto(db, code);
  if (!produto) {
    toast(`Código ${code} não cadastrado. Cadastre o produto no estoque.`, 'error');
    return;
  }
  adicionarItemPDV(produto.id, 1);
}

function adicionarItemPDV(produtoId, qtd) {
  const db = getDB();
  const produto = db.estoque.find(p => p.id === produtoId);
  if (!produto) { toast('Selecione um produto', 'error'); return; }
  if (qtd <= 0) { toast('Quantidade inválida', 'error'); return; }
  const jaNoCarrinho = carrinhoPDV.filter(i => i.id === produtoId).reduce((s, i) => s + i.qtd, 0);
  if (jaNoCarrinho + qtd > produto.qtd) {
    toast(`Estoque insuficiente para ${produto.nome}. Disponível: ${produto.qtd - jaNoCarrinho}`, 'error');
    return;
  }
  const existente = carrinhoPDV.find(i => i.id === produtoId);
  if (existente) existente.qtd += qtd;
  else carrinhoPDV.push({ id: produto.id, nome: produto.nome, valor: produto.venda, custo: produto.custo, qtd, imagem: produto.imagem || '' });
  renderPDV();
}

function removerItemPDV(i) { carrinhoPDV.splice(i, 1); renderPDV(); }

function onFormaChange() {
  const forma = document.getElementById('pdv-forma').value;
  document.getElementById('pdv-parcelas-wrap').hidden = forma !== 'Cartão de crédito parcelado' && forma !== 'Pendente';
  document.getElementById('pdv-combinado-wrap').hidden = forma !== 'Combinado';
  if (forma === 'Pendente') {
    // A prazo: usa 1 parcela por padrão, mas permite mais
    document.getElementById('pdv-n-parcelas').value = '1';
  }
  atualizarTotaisPDV();
}

function atualizarTotaisPDV() {
  const sub = pdvSubtotal();
  const desc = Math.min(sub, parseNumber(document.getElementById('pdv-desconto').value));
  const total = Math.max(0, sub - desc);
  document.getElementById('pdv-subtotal').textContent = formatBRL(sub);
  document.getElementById('pdv-t-subtotal').textContent = formatBRL(sub);
  document.getElementById('pdv-t-desconto').textContent = '- ' + formatBRL(desc);
  document.getElementById('pdv-t-total').textContent = formatBRL(total);
  const forma = document.getElementById('pdv-forma').value;
  if (forma === 'Cartão de crédito parcelado' || forma === 'Pendente') renderPreviewParcelas();
  if (forma === 'Combinado') {
    document.getElementById('pdv-valor2').value = (total - parseNumber(document.getElementById('pdv-valor1').value)).toFixed(2);
  }
}

function renderPDV() {
  const db = getDB();
  // Produtos com estoque > 0
  const prodSel = document.getElementById('pdv-produto');
  prodSel.innerHTML = db.estoque.filter(p => p.qtd > 0)
    .map(p => `<option value="${p.id}">${escapeHTML(p.nome)} — est. ${p.qtd} — ${formatBRL(p.venda)}</option>`).join('')
    || '<option value="">Nenhum produto com estoque</option>';
  const cliSel = document.getElementById('pdv-cliente');
  cliSel.innerHTML = '<option value="">Cliente avulso</option>' +
    db.clientes.map(c => `<option value="${c.id}">${escapeHTML(c.nome)}${c.whatsapp ? ' · ' + escapeHTML(c.whatsapp) : ''}</option>`).join('');
  if (!document.getElementById('pdv-data').value) document.getElementById('pdv-data').value = todayISO();
  if (!document.getElementById('pdv-primeiro-venc').value) document.getElementById('pdv-primeiro-venc').value = somarMeses(todayISO(), 1);

  const body = document.getElementById('pdv-carrinho-body');
  const empty = document.getElementById('pdv-empty');
  if (!carrinhoPDV.length) {
    body.innerHTML = '<tr class="cart-empty-row"><td colspan="5">Nenhum item adicionado</td></tr>';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    body.innerHTML = carrinhoPDV.map((it, i) => `
      <tr>
        <td>${it.imagem ? `<img src="${it.imagem}" class="row-thumb" style="width:32px;height:32px;margin-right:8px;vertical-align:middle;">` : ''}${escapeHTML(it.nome)}</td>
        <td><input type="number" value="${it.qtd}" min="1" style="width:60px;padding:4px 8px;" data-qtd="${i}"></td>
        <td class="num">${formatBRL(it.valor)}</td>
        <td class="num">${formatBRL(it.valor * it.qtd)}</td>
        <td><button class="icon-btn danger" data-rm="${i}">${icon('trash')}</button></td>
      </tr>`).join('');
    body.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => removerItemPDV(Number(b.dataset.rm))));
    body.querySelectorAll('[data-qtd]').forEach(inp => inp.addEventListener('change', e => {
      const i = Number(e.target.dataset.qtd);
      const nova = parseNumber(e.target.value);
      const prod = getDB().estoque.find(p => p.id === carrinhoPDV[i].id);
      if (prod && nova > prod.qtd) { toast(`Estoque máximo: ${prod.qtd}`, 'error'); e.target.value = carrinhoPDV[i].qtd; return; }
      if (nova <= 0) { removerItemPDV(i); return; }
      carrinhoPDV[i].qtd = nova;
      renderPDV();
    }));
  }
  atualizarTotaisPDV();
}

function finalizarPDV() {
  if (!carrinhoPDV.length) { toast('Adicione ao menos um item', 'error'); return; }
  const db = getDB();
  const sub = pdvSubtotal();
  const desc = Math.min(sub, parseNumber(document.getElementById('pdv-desconto').value));
  const total = Math.max(0, sub - desc);
  const forma = document.getElementById('pdv-forma').value;
  const clienteId = document.getElementById('pdv-cliente').value;
  const cliente = db.clientes.find(c => c.id === clienteId);
  const dataVenda = document.getElementById('pdv-data').value || todayISO();

  // Atualiza estoque
  carrinhoPDV.forEach(it => {
    const produto = db.estoque.find(p => p.id === it.id);
    if (produto) produto.qtd -= it.qtd;
  });

  const venda = {
    id: uid(), type: 'venda', numero: nextNumero(db, 'venda'),
    data: dataVenda, criadoEm: new Date().toISOString(),
    cliente: cliente ? cliente.nome : 'Cliente avulso',
    clienteId: clienteId || '',
    clienteWhatsapp: cliente ? (cliente.whatsapp || '') : '',
    desconto: desc, total,
    itens: carrinhoPDV.map(it => ({ id: it.id, nome: it.nome, qtd: it.qtd, valor: it.valor, custo: it.custo }))
  };

  if (forma === 'Cartão de crédito parcelado' || forma === 'Pendente') {
    const n = Number(document.getElementById('pdv-n-parcelas').value) || 1;
    const juros = parseNumber(document.getElementById('pdv-juros').value);
    const primeiro = document.getElementById('pdv-primeiro-venc').value || somarMeses(todayISO(), 1);
    const { parcelas, valorTotal } = calcularParcelas(total, n, juros, primeiro);
    venda.pagamento = forma === 'Pendente' ? `A prazo (${n}x)` : `Cartão de crédito parcelado (${n}x)`;
    venda.parcelas = parcelas;
    venda.totalComJuros = valorTotal;
    venda.valorRecebido = 0;
    venda.saldoPendente = valorTotal;
    venda.status = 'parcelado';
    venda.vencimento = parcelas[0].vencimento;
    venda.pagoEm = '';
  } else if (forma === 'Combinado') {
    const v1 = parseNumber(document.getElementById('pdv-valor1').value);
    const f1 = document.getElementById('pdv-forma1').value;
    const f2 = document.getElementById('pdv-forma2').value;
    if (v1 <= 0 || v1 >= total) { toast('Informe o valor da 1ª forma de pagamento (menor que o total).', 'error');
      // Reverte estoque
      carrinhoPDV.forEach(it => { const p = db.estoque.find(x => x.id === it.id); if (p) p.qtd += it.qtd; });
      return;
    }
    venda.pagamento = `${f1} (${formatBRL(v1)}) + ${f2} (${formatBRL(total - v1)})`;
    venda.pagamentos = [{ forma: f1, valor: v1 }, { forma: f2, valor: total - v1 }];
    venda.status = 'pago';
    venda.pagoEm = todayISO();
    venda.valorRecebido = total;
    venda.saldoPendente = 0;
  } else {
    venda.pagamento = forma;
    venda.status = 'pago';
    venda.pagoEm = todayISO();
    venda.valorRecebido = total;
    venda.saldoPendente = 0;
  }

  db.vendas.push(venda);
  registrarLog(db, 'Venda registrada (PDV)', { Nota: venda.numero, Cliente: venda.cliente, Itens: venda.itens.length, Total: formatBRL(venda.total), Pagamento: venda.pagamento, Status: venda.status });
  saveDB(db);
  toast(`Venda ${venda.numero} registrada`, 'success');
  carrinhoPDV = [];
  renderPDV();
  refreshCurrentView();
  renderNota(venda, db);
}

// ---- Registrar pagamento de parcela (usado também em pendências/vendas) ----
function pagarParcela(vendaId, parcelaId, valor) {
  const db = getDB();
  const venda = db.vendas.find(v => v.id === vendaId);
  if (!venda || !venda.parcelas) return false;
  const parcela = venda.parcelas.find(p => p.id === parcelaId);
  if (!parcela) return false;
  const v = Number(valor) > 0 ? Math.min(Number(valor), parcela.valor - (parcela.recebido || 0)) : parcela.valor - (parcela.recebido || 0);
  parcela.recebido = Math.round(((parcela.recebido || 0) + v) * 100) / 100;
  if (parcela.recebido >= parcela.valor - 0.001) { parcela.status = 'pago'; parcela.pagoEm = todayISO(); }
  venda.valorRecebido = Math.round(venda.parcelas.reduce((s, p) => s + (p.recebido || 0), 0) * 100) / 100;
  venda.saldoPendente = Math.round(((venda.totalComJuros || venda.total) - venda.valorRecebido) * 100) / 100;
  if (venda.saldoPendente <= 0.001) { venda.status = 'pago'; venda.pagoEm = todayISO(); }
  registrarLog(db, 'Pagamento de parcela recebido', { Nota: venda.numero, Parcela: parcela.numero + 'ª', Valor: formatBRL(v) });
  saveDB(db);
  return true;
}
