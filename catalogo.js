/* ============================================================
   catalogo.js — Catálogo virtual de produtos para compartilhar.
   ============================================================ */
function initCatalogo() {
  ViewRenderers.catalogo = renderCatalogo;
  ViewActions.catalogo = el => { el.innerHTML = ''; };
  document.getElementById('cat-busca').addEventListener('input', renderCatalogo);
  document.getElementById('cat-filtro-categoria').addEventListener('change', renderCatalogo);
  document.getElementById('cat-compartilhar').addEventListener('click', compartilharCatalogo);
}

function renderCatalogo() {
  const db = getDB();
  const catSel = document.getElementById('cat-filtro-categoria');
  if (catSel.options.length <= 1) {
    catSel.innerHTML = '<option value="">Todas as categorias</option>' +
      db.config.categorias.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  }
  const busca = (document.getElementById('cat-busca').value || '').toLowerCase();
  const cat = catSel.value;
  const produtos = db.estoque.filter(p => {
    if (p.qtd <= 0) return false;
    if (cat && p.categoria !== cat) return false;
    if (busca && !`${p.nome} ${p.marca || ''}`.toLowerCase().includes(busca)) return false;
    return true;
  });
  const grid = document.getElementById('catalogo-grid');
  const empty = document.getElementById('catalogo-empty');
  if (!produtos.length) { grid.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;
  grid.innerHTML = produtos.map(p => {
    const baixo = lowStock(p, db);
    const inicial = (p.nome || '?').charAt(0).toUpperCase();
    return `<div class="catalog-card">
      <div class="catalog-img">${p.imagem ? `<img src="${p.imagem}" alt="${escapeHTML(p.nome)}">` : `<span class="catalog-img-placeholder">${inicial}</span>`}</div>
      <div class="catalog-body">
        <span class="cat">${escapeHTML(p.categoria || '')}${p.marca ? ' · ' + escapeHTML(p.marca) : ''}</span>
        <strong>${escapeHTML(p.nome)}</strong>
        <span class="catalog-price">${formatBRL(p.venda)}</span>
        <span class="catalog-stock ${baixo ? 'low' : ''}">${baixo ? '⏳ Últimas unidades' : '✅ Em estoque (' + p.qtd + ')'}</span>
      </div>
    </div>`;
  }).join('');
}

function compartilharCatalogo() {
  const db = getDB();
  const produtos = db.estoque.filter(p => p.qtd > 0);
  if (!produtos.length) { toast('Nenhum produto disponível para o catálogo.', 'error'); return; }
  let texto = `🛍️ *${db.config.nome}* — Catálogo\n\n`;
  const porCat = {};
  produtos.forEach(p => { const c = p.categoria || 'Geral'; (porCat[c] = porCat[c] || []).push(p); });
  Object.entries(porCat).forEach(([cat, itens]) => {
    texto += `*${cat}*\n`;
    itens.forEach(p => { texto += `• ${p.nome} — ${formatBRL(p.venda)}\n`; });
    texto += '\n';
  });
  texto += `Faça seu pedido pelo WhatsApp! 📱 ${db.config.telefone || ''}`;
  const telefoneLoja = (db.config.telefone || '').replace(/\D/g, '');
  const url = telefoneLoja
    ? `https://wa.me/${telefoneLoja}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  if (navigator.share) {
    navigator.share({ title: `Catálogo ${db.config.nome}`, text: texto }).catch(() => window.open(url, '_blank'));
  } else {
    window.open(url, '_blank');
  }
  toast('Catálogo preparado para compartilhamento.', 'success');
}
