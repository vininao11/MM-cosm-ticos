function initClientes() {
  document.getElementById('clientes-busca').addEventListener('input', renderClientes);
  ViewRenderers.clientes = renderClientes;
  ViewActions.clientes = el => {
    el.innerHTML = `<button class="btn btn-primary" id="btn-novo-cliente">${icon('plus')} Novo cliente</button>`;
    document.getElementById('btn-novo-cliente').addEventListener('click', () => abrirModalCliente());
  };
}

function formClienteHTML(cliente) {
  const c = cliente || {};
  const isEdit = !!cliente;
  return `
    <h3>${isEdit ? 'Editar cliente' : 'Novo cliente'}</h3>
    <div class="form-grid">
      <label class="field wide"><span>Nome</span><input type="text" id="f-cli-nome" value="${escapeHTML(c.nome || '')}"></label>
      <label class="field"><span>WhatsApp</span><input type="text" id="f-cli-whats" value="${escapeHTML(c.whatsapp || '')}" placeholder="DDD + número"></label>
      <label class="field"><span>CPF</span><input type="text" id="f-cli-cpf" value="${escapeHTML(c.cpf || '')}"></label>
      <label class="field wide"><span>E-mail</span><input type="email" id="f-cli-email" value="${escapeHTML(c.email || '')}"></label>
      <label class="field wide"><span>Endereço</span><input type="text" id="f-cli-endereco" value="${escapeHTML(c.endereco || '')}"></label>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-salvar-cliente">${isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
      <button class="btn btn-ghost" id="btn-cancelar-cliente">Cancelar</button>
    </div>`;
}

function abrirModalCliente(id) {
  const db = getDB();
  const cliente = id ? db.clientes.find(c => c.id === id) : null;
  openModal(formClienteHTML(cliente));
  document.getElementById('btn-salvar-cliente').addEventListener('click', () => salvarCliente(id));
  document.getElementById('btn-cancelar-cliente').addEventListener('click', closeModal);
}

function salvarCliente(id) {
  const nome = document.getElementById('f-cli-nome').value.trim();
  if (!nome) { toast('Informe o nome do cliente', 'error'); return; }
  const dados = {
    nome,
    whatsapp: document.getElementById('f-cli-whats').value.trim(),
    cpf: document.getElementById('f-cli-cpf').value.trim(),
    email: document.getElementById('f-cli-email').value.trim(),
    endereco: document.getElementById('f-cli-endereco').value.trim()
  };
  const db = getDB();
  if (id) {
    Object.assign(db.clientes.find(c => c.id === id), dados);
    registrarLog(db, 'Cliente editado', { Cliente: nome });
    toast('Cliente atualizado');
  } else {
    dados.id = uid();
    dados.criadoEm = new Date().toISOString();
    db.clientes.push(dados);
    registrarLog(db, 'Cliente cadastrado', { Cliente: nome });
    toast('Cliente cadastrado');
  }
  saveDB(db);
  closeModal();
  renderClientes();
}

function excluirCliente(id) {
  if (!confirm('Excluir este cliente? O histórico de vendas dele será mantido.')) return;
  const db = getDB();
  const cliente = db.clientes.find(c => c.id === id);
  db.clientes = db.clientes.filter(c => c.id !== id);
  registrarLog(db, 'Cliente excluído', { Cliente: cliente ? cliente.nome : id });
  saveDB(db);
  renderClientes();
  toast('Cliente excluído');
}

function renderClientes() {
  const db = getDB();
  const busca = (document.getElementById('clientes-busca').value || '').toLowerCase();
  const lista = db.clientes.filter(c => `${c.nome} ${c.whatsapp || ''} ${c.cpf || ''}`.toLowerCase().includes(busca));
  const tbody = document.getElementById('clientes-tbody');
  const empty = document.getElementById('clientes-empty');
  const scrollWrap = tbody.closest('.table-scroll');
  if (!lista.length) {
    scrollWrap.style.display = 'none';
    empty.hidden = false;
    empty.textContent = db.clientes.length ? 'Nenhum cliente encontrado com esse filtro.' : 'Nenhum cliente cadastrado ainda.';
  } else {
    scrollWrap.style.display = '';
    empty.hidden = true;
  }
  let totalGeral = 0, comprasPagas = 0;
  tbody.innerHTML = lista.map(c => {
    const vendas = db.vendas.filter(v => v.clienteId === c.id);
    const pagas = vendas.filter(v => v.status === 'pago');
    const total = pagas.reduce((s, v) => s + v.total, 0);
    totalGeral += total;
    comprasPagas += pagas.length;
    const ultima = vendas.slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];
    return `
      <tr>
        <td><strong>${escapeHTML(c.nome)}</strong>${c.email ? `<div class="kpi-note">${escapeHTML(c.email)}</div>` : ''}</td>
        <td>${escapeHTML(c.whatsapp || '-')}</td>
        <td class="mono">${escapeHTML(c.cpf || '-')}</td>
        <td class="num">${vendas.length}</td>
        <td class="num">${formatBRL(total)}</td>
        <td>${ultima ? formatDateBR(ultima.data) : '-'}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${c.id}">${icon('edit')}</button>
          <button class="icon-btn danger" data-del="${c.id}">${icon('trash')}</button>
        </td>
      </tr>`;
  }).join('');
  document.getElementById('cli-kpi-total').textContent = db.clientes.length;
  document.getElementById('cli-kpi-total-gasto').textContent = formatBRL(totalGeral);
  document.getElementById('cli-kpi-ticket').textContent = formatBRL(comprasPagas ? totalGeral / comprasPagas : 0);
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => abrirModalCliente(btn.dataset.edit)));
  tbody.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => excluirCliente(btn.dataset.del)));
}
