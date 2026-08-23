function initEstoque() {
  document.getElementById('estoque-busca').addEventListener('input', renderEstoque);
  document.getElementById('estoque-filtro-categoria').addEventListener('change', renderEstoque);
  ViewRenderers.estoque = renderEstoque;
  ViewActions.estoque = el => {
    el.innerHTML = `<button class="btn btn-primary" id="btn-novo-produto">${icon('plus')} Novo produto</button>`;
    document.getElementById('btn-novo-produto').addEventListener('click', () => abrirModalProduto());
  };
}

function lowStock(p, db) {
  return p.qtd <= (p.minimo ?? db.config.estoqueMinimo);
}

function formProdutoHTML(db, produto) {
  const p = produto || {};
  const isEdit = !!produto;
  const catOptions = db.config.categorias.map(c => `<option value="${escapeHTML(c)}" ${p.categoria === c ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('');
  return `
    <h3>${isEdit ? 'Editar produto' : 'Novo produto'}</h3>
    <div class="form-grid">
      <label class="field wide"><span>Nome do produto</span><input type="text" id="f-prod-nome" value="${escapeHTML(p.nome || '')}" placeholder="Ex: 212 VIP Rosé 80ml"></label>
      <label class="field"><span>Marca</span><input type="text" id="f-prod-marca" value="${escapeHTML(p.marca || '')}"></label>
      <label class="field"><span>Categoria</span><select id="f-prod-categoria">${catOptions}</select></label>
      <label class="field"><span>Código / SKU</span><input type="text" id="f-prod-codigo" value="${escapeHTML(p.codigo || '')}" placeholder="Opcional"></label>
      <label class="field"><span>Quantidade em estoque</span><input type="number" id="f-prod-qtd" min="0" step="1" value="${p.qtd ?? 0}"></label>
      <label class="field"><span>Estoque mínimo</span><input type="number" id="f-prod-min" min="0" step="1" value="${p.minimo ?? db.config.estoqueMinimo}"></label>
      <label class="field"><span>Preço de custo (R$)</span><input type="number" id="f-prod-custo" min="0" step="0.01" value="${p.custo ?? ''}"></label>
      <label class="field"><span>Preço de venda (R$)</span><input type="number" id="f-prod-venda" min="0" step="0.01" value="${p.venda ?? ''}"></label>
      <label class="field wide"><span>Cliente de referência</span><input type="text" id="f-prod-cliente" value="${escapeHTML(p.clienteReferencia || '')}" placeholder="Nome do cliente relacionado ao controle deste item"></label>
      <label class="field wide file-field"><span>Foto do produto (opcional)</span><input type="file" id="f-prod-imagem" accept="image/*"></label>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-salvar-produto">${isEdit ? 'Salvar alterações' : 'Cadastrar produto'}</button>
      <button class="btn btn-ghost" id="btn-cancelar-produto">Cancelar</button>
    </div>`;
}

let produtoImagemPendente = '';

function abrirModalProduto(id) {
  const db = getDB();
  const produto = id ? db.estoque.find(p => p.id === id) : null;
  produtoImagemPendente = produto ? produto.imagem || '' : '';
  openModal(formProdutoHTML(db, produto));
  document.getElementById('btn-salvar-produto').addEventListener('click', () => salvarProduto(id));
  document.getElementById('btn-cancelar-produto').addEventListener('click', closeModal);
  document.getElementById('f-prod-imagem').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    comprimirImagem(file, 260).then(dataUrl => { produtoImagemPendente = dataUrl; });
  });
}

function salvarProduto(id) {
  const nome = document.getElementById('f-prod-nome').value.trim();
  if (!nome) { toast('Informe o nome do produto', 'error'); return; }
  const dados = {
    nome,
    marca: document.getElementById('f-prod-marca').value.trim(),
    categoria: document.getElementById('f-prod-categoria').value,
    codigo: document.getElementById('f-prod-codigo').value.trim(),
    qtd: parseNumber(document.getElementById('f-prod-qtd').value),
    minimo: parseNumber(document.getElementById('f-prod-min').value),
    custo: parseNumber(document.getElementById('f-prod-custo').value),
    venda: parseNumber(document.getElementById('f-prod-venda').value),
    clienteReferencia: document.getElementById('f-prod-cliente').value.trim(),
    imagem: produtoImagemPendente || ''
  };
  const db = getDB();
  if (id) {
    Object.assign(db.estoque.find(p => p.id === id), dados);
    registrarLog(db, 'Produto editado', { Produto: nome, Estoque: dados.qtd, Venda: formatBRL(dados.venda) });
    toast('Produto atualizado');
  } else {
    dados.id = uid();
    dados.criadoEm = new Date().toISOString();
    db.estoque.push(dados);
    registrarLog(db, 'Produto cadastrado', { Produto: nome, Categoria: dados.categoria, Estoque: dados.qtd, Venda: formatBRL(dados.venda) });
    toast('Produto cadastrado');
  }
  saveDB(db);
  closeModal();
  renderEstoque();
}

function excluirProduto(id) {
  if (!confirm('Excluir este produto do estoque? O histórico de vendas e compras não será afetado.')) return;
  const db = getDB();
  const produto = db.estoque.find(p => p.id === id);
  db.estoque = db.estoque.filter(p => p.id !== id);
  registrarLog(db, 'Produto excluído', { Produto: produto ? produto.nome : id });
  saveDB(db);
  renderEstoque();
  toast('Produto excluído');
}

function filtrarProdutos(db) {
  const busca = (document.getElementById('estoque-busca').value || '').toLowerCase();
  const categoria = document.getElementById('estoque-filtro-categoria').value;
  return db.estoque.filter(p => {
    const texto = `${p.nome} ${p.marca || ''} ${p.codigo || ''}`.toLowerCase();
    return (!busca || texto.includes(busca)) && (!categoria || p.categoria === categoria);
  });
}

function renderEstoque() {
  const db = getDB();
  renderCategoriaOptions();
  const filtrados = filtrarProdutos(db).slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const tbody = document.getElementById('estoque-tbody');
  const empty = document.getElementById('estoque-empty');
  const scrollWrap = tbody.closest('.table-scroll');
  if (!filtrados.length) {
    scrollWrap.style.display = 'none';
    empty.hidden = false;
    empty.textContent = db.estoque.length ? 'Nenhum produto encontrado com esse filtro.' : 'Nenhum produto cadastrado ainda. Cadastre o primeiro produto para começar a controlar o estoque.';
  } else {
    scrollWrap.style.display = '';
    empty.hidden = true;
  }
  tbody.innerHTML = filtrados.map(p => {
    const baixo = lowStock(p, db);
    const margem = p.custo ? Math.round((p.venda - p.custo) / p.custo * 100) + '%' : '—';
    return `
      <tr>
        <td>${p.imagem ? `<img class="row-thumb" src="${p.imagem}" alt="">` : '<div class="row-thumb"></div>'}</td>
        <td><strong>${escapeHTML(p.nome)}</strong>${p.marca ? `<div class="kpi-note">${escapeHTML(p.marca)}</div>` : ''}</td>
        <td>${escapeHTML(p.categoria || '-')}</td>
        <td class="mono">${escapeHTML(p.codigo || '-')}</td>
        <td>${escapeHTML(p.clienteReferencia || '-')}</td>
        <td class="num">${p.qtd}${baixo ? ` <span class="badge badge-baixo">baixo</span>` : ''}<div class="stockbar"><i class="stockbar-fill${baixo ? ' low' : ''}" style="width:${Math.min(100, Math.round((p.qtd / (Math.max(p.minimo ?? db.config.estoqueMinimo, 1) * 3)) * 100))}%"></i></div></td>
        <td class="num">${formatBRL(p.custo)}</td>
        <td class="num">${formatBRL(p.venda)}</td>
        <td class="num">${margem}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${p.id}">${icon('edit')}</button>
          <button class="icon-btn danger" data-del="${p.id}">${icon('trash')}</button>
        </td>
      </tr>`;
  }).join('');
  document.getElementById('est-kpi-total').textContent = db.estoque.length;
  document.getElementById('est-kpi-valor').textContent = formatBRL(db.estoque.reduce((s, p) => s + p.qtd * p.custo, 0));
  document.getElementById('est-kpi-alerta').textContent = db.estoque.filter(p => lowStock(p, db)).length;
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => abrirModalProduto(btn.dataset.edit)));
  tbody.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => excluirProduto(btn.dataset.del)));
}
