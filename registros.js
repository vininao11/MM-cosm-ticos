function initRegistros() {
  document.getElementById('registros-busca').addEventListener('input', renderRegistros);
  ViewRenderers.registros = renderRegistros;
}

function renderRegistros() {
  const db = getDB();
  const busca = (document.getElementById('registros-busca').value || '').toLowerCase();
  const lista = db.logs.filter(l => `${l.usuario} ${l.acao}`.toLowerCase().includes(busca)).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const tbody = document.getElementById('registros-tbody');
  const empty = document.getElementById('registros-empty');
  const scrollWrap = tbody.closest('.table-scroll');
  if (!lista.length) {
    scrollWrap.style.display = 'none';
    empty.hidden = false;
    empty.textContent = db.logs.length ? 'Nenhum registro encontrado com esse filtro.' : 'Nenhum registro ainda.';
  } else {
    scrollWrap.style.display = '';
    empty.hidden = true;
  }
  tbody.innerHTML = lista.slice(0, 300).map(l => `
    <tr>
      <td class="mono">${formatDateHora(l.data)}</td>
      <td>${escapeHTML(l.usuario || '-')}</td>
      <td>${escapeHTML(l.acao)}</td>
      <td class="row-actions"><button class="icon-btn" data-detail="${l.id}">${icon('eye')}</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => abrirDetalheLog(btn.dataset.detail)));
}

function abrirDetalheLog(id) {
  const db = getDB();
  const log = db.logs.find(l => l.id === id);
  if (!log) return;
  const linhas = Object.entries(log.detalhes || {});
  document.getElementById('detail-body').innerHTML = `
    <h3>${escapeHTML(log.acao)}</h3>
    <div class="detail-list">
      <div class="detail-row"><span>Usuário</span><b>${escapeHTML(log.usuario || '-')}</b></div>
      <div class="detail-row"><span>Data e hora</span><b>${formatDateHora(log.data)}</b></div>
      ${linhas.map(([label, valor]) => `<div class="detail-row"><span>${escapeHTML(label)}</span><b>${escapeHTML(String(valor))}</b></div>`).join('')}
    </div>`;
  document.getElementById('detail-overlay').classList.add('show');
}
