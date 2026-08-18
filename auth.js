const SESSION_KEY = 'mmg_session';

async function hashSenha(senha) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(senha);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  let hash = 0;
  for (let i = 0; i < senha.length; i++) {
    const char = senha.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'local_' + Math.abs(hash).toString(16);
}

function normalizarTexto(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z]/g, '');
}

function gerarUsername(nome, sobrenome) {
  return `${normalizarTexto(nome)}.${normalizarTexto(sobrenome)}`;
}

function gerarUsernameUnico(db, nome, sobrenome) {
  const base = gerarUsername(nome, sobrenome);
  let username = base, i = 1;
  while (db.usuarios.some(u => u.username === username)) { i++; username = `${base}${i}`; }
  return username;
}

function getUsuarioLogado() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  const db = getDB();
  return db.usuarios.find(u => u.username === username) || null;
}

function setSessao(username) {
  localStorage.setItem(SESSION_KEY, username);
}

function limparSessao() {
  localStorage.removeItem(SESSION_KEY);
}

function initAuth() {
  const usuario = getUsuarioLogado();
  if (usuario) { entrarNoApp(usuario); return; }
  const db = getDB();
  if (!db.usuarios.length) mostrarCriarPrimeiroUsuario();
  else mostrarLogin();
}

function entrarNoApp(usuario) {
  document.getElementById('auth-screen').hidden = true;
  document.getElementById('app').hidden = false;
  document.getElementById('sidebar-user-name').textContent = `${usuario.nome} ${usuario.sobrenome}`;
  document.getElementById('sidebar-user-role').textContent = '@' + usuario.username;
  applyConfigToUI();
  setView('painel');
}

function fazerLogout() {
  const usuario = getUsuarioLogado();
  if (usuario) {
    const db = getDB();
    registrarLog(db, 'Saiu do sistema', { Usuário: `${usuario.nome} ${usuario.sobrenome}` });
    saveDB(db);
  }
  limparSessao();
  document.getElementById('app').hidden = true;
  document.getElementById('auth-screen').hidden = false;
  mostrarLogin();
}

function mostrarLogin(erro) {
  document.getElementById('auth-body').innerHTML = `
    <div class="auth-body">
      <h3>Entrar</h3>
      ${erro ? `<div class="auth-error">${escapeHTML(erro)}</div>` : ''}
      <label class="auth-field"><span>Usuário</span><input type="text" id="login-username" placeholder="nome.sobrenome" autocomplete="username"></label>
      <label class="auth-field"><span>Senha</span><input type="password" id="login-senha" autocomplete="current-password"></label>
      <button class="btn btn-primary btn-block" id="btn-fazer-login">Entrar</button>
      <button class="auth-link" id="btn-esqueci-senha">Esqueci minha senha</button>
    </div>`;
  document.getElementById('btn-fazer-login').addEventListener('click', fazerLogin);
  document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });
  document.getElementById('btn-esqueci-senha').addEventListener('click', mostrarRecuperar1);
  const campoUser = document.getElementById('login-username');
  if (campoUser) campoUser.focus();
}

async function fazerLogin() {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value;
  if (!username || !senha) { mostrarLogin('Preencha usuário e senha'); return; }
  const db = getDB();
  const usuario = db.usuarios.find(u => u.username === username);
  if (!usuario) { mostrarLogin('Usuário ou senha inválidos'); return; }
  const hash = await hashSenha(senha);
  if (hash !== usuario.senhaHash) { mostrarLogin('Usuário ou senha inválidos'); return; }
  setSessao(usuario.username);
  registrarLog(db, 'Entrou no sistema', { Usuário: `${usuario.nome} ${usuario.sobrenome}` });
  saveDB(db);
  entrarNoApp(usuario);
}

function mostrarCriarPrimeiroUsuario() {
  document.getElementById('auth-body').innerHTML = `
    <div class="auth-body">
      <h3>Criar acesso principal</h3>
      <p class="auth-hint">Este será o primeiro usuário do sistema. Cadastre o restante da equipe depois, em Configurações.</p>
      <label class="auth-field"><span>Nome</span><input type="text" id="fu-nome"></label>
      <label class="auth-field"><span>Sobrenome</span><input type="text" id="fu-sobrenome"></label>
      <label class="auth-field"><span>E-mail (para recuperação de senha)</span><input type="email" id="fu-email"></label>
      <label class="auth-field"><span>Senha</span><input type="password" id="fu-senha"></label>
      <label class="auth-field"><span>Confirmar senha</span><input type="password" id="fu-senha2"></label>
      <button class="btn btn-primary btn-block" id="btn-criar-primeiro">Criar e entrar</button>
    </div>`;
  document.getElementById('btn-criar-primeiro').addEventListener('click', criarPrimeiroUsuario);
}

async function criarPrimeiroUsuario() {
  const nome = document.getElementById('fu-nome').value.trim();
  const sobrenome = document.getElementById('fu-sobrenome').value.trim();
  const email = document.getElementById('fu-email').value.trim();
  const senha = document.getElementById('fu-senha').value;
  const senha2 = document.getElementById('fu-senha2').value;
  if (!nome || !sobrenome) { toast('Informe nome e sobrenome', 'error'); return; }
  if (senha.length < 4) { toast('A senha deve ter pelo menos 4 caracteres', 'error'); return; }
  if (senha !== senha2) { toast('As senhas não coincidem', 'error'); return; }
  const db = getDB();
  const username = gerarUsernameUnico(db, nome, sobrenome);
  const usuario = { id: uid(), nome, sobrenome, username, email, senhaHash: await hashSenha(senha), criadoEm: new Date().toISOString() };
  db.usuarios.push(usuario);
  registrarLog(db, 'Usuário criado', { Usuário: `${nome} ${sobrenome}`, Login: username });
  saveDB(db);
  setSessao(username);
  entrarNoApp(usuario);
}

function mostrarRecuperar1() {
  document.getElementById('auth-body').innerHTML = `
    <div class="auth-body">
      <h3>Recuperar senha</h3>
      <p class="auth-hint">Informe seu usuário. Vamos gerar um código de verificação vinculado ao seu e-mail cadastrado.</p>
      <label class="auth-field"><span>Usuário</span><input type="text" id="rec-username" placeholder="nome.sobrenome"></label>
      <button class="btn btn-primary btn-block" id="btn-gerar-codigo">Gerar código</button>
      <button class="auth-link" id="btn-voltar-login">Voltar para o login</button>
    </div>`;
  document.getElementById('btn-gerar-codigo').addEventListener('click', gerarCodigoRecuperacao);
  document.getElementById('btn-voltar-login').addEventListener('click', () => mostrarLogin());
}

function gerarCodigoRecuperacao() {
  const username = document.getElementById('rec-username').value.trim().toLowerCase();
  const db = getDB();
  const usuario = db.usuarios.find(u => u.username === username);
  if (!usuario) { toast('Usuário não encontrado', 'error'); return; }
  if (!usuario.email) { toast('Esse usuário não tem e-mail cadastrado. Peça a um administrador para redefinir sua senha em Configurações.', 'error'); return; }
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  usuario.recuperacaoCodigo = codigo;
  usuario.recuperacaoExpira = Date.now() + 15 * 60 * 1000;
  registrarLog(db, 'Código de recuperação gerado', { Usuário: `${usuario.nome} ${usuario.sobrenome}` });
  saveDB(db);
  mostrarRecuperar2(username, usuario.email, codigo);
}

function mostrarRecuperar2(username, email, codigo) {
  document.getElementById('auth-body').innerHTML = `
    <div class="auth-body">
      <h3>Verificar código</h3>
      <p class="auth-hint">Este site não tem servidor de e-mail próprio, então o código não é enviado de verdade: ele aparece abaixo só para você continuar a recuperação agora.</p>
      <div class="auth-code-box">
        <span>Código para ${escapeHTML(email)}</span>
        <strong>${codigo}</strong>
      </div>
      <label class="auth-field"><span>Digite o código</span><input type="text" id="rec-codigo" maxlength="6"></label>
      <label class="auth-field"><span>Nova senha</span><input type="password" id="rec-senha"></label>
      <label class="auth-field"><span>Confirmar nova senha</span><input type="password" id="rec-senha2"></label>
      <button class="btn btn-primary btn-block" id="btn-confirmar-recuperacao">Redefinir senha</button>
      <button class="auth-link" id="btn-voltar-login2">Voltar para o login</button>
    </div>`;
  document.getElementById('btn-confirmar-recuperacao').addEventListener('click', () => confirmarRecuperacao(username));
  document.getElementById('btn-voltar-login2').addEventListener('click', () => mostrarLogin());
}

async function confirmarRecuperacao(username) {
  const codigo = document.getElementById('rec-codigo').value.trim();
  const senha = document.getElementById('rec-senha').value;
  const senha2 = document.getElementById('rec-senha2').value;
  const db = getDB();
  const usuario = db.usuarios.find(u => u.username === username);
  if (!usuario || !usuario.recuperacaoCodigo) { toast('Solicite um novo código', 'error'); return; }
  if (Date.now() > usuario.recuperacaoExpira) { toast('Código expirado, gere um novo', 'error'); return; }
  if (codigo !== usuario.recuperacaoCodigo) { toast('Código incorreto', 'error'); return; }
  if (senha.length < 4) { toast('A senha deve ter pelo menos 4 caracteres', 'error'); return; }
  if (senha !== senha2) { toast('As senhas não coincidem', 'error'); return; }
  usuario.senhaHash = await hashSenha(senha);
  delete usuario.recuperacaoCodigo;
  delete usuario.recuperacaoExpira;
  registrarLog(db, 'Senha redefinida', { Usuário: `${usuario.nome} ${usuario.sobrenome}` });
  saveDB(db);
  toast('Senha redefinida com sucesso');
  mostrarLogin();
}

function initUsuarios() {
  document.getElementById('btn-novo-usuario').addEventListener('click', () => abrirModalUsuario());
  document.getElementById('btn-logout').addEventListener('click', fazerLogout);
  ViewRenderers.config = renderUsuariosLista;
}

function renderUsuariosLista() {
  const db = getDB();
  const atual = getUsuarioLogado();
  const wrap = document.getElementById('usuarios-lista');
  wrap.innerHTML = db.usuarios.length
    ? db.usuarios.map(u => `
      <div class="user-row">
        <div><strong>${escapeHTML(u.nome)} ${escapeHTML(u.sobrenome)}${atual && atual.id === u.id ? ' (você)' : ''}</strong><span>${escapeHTML(u.username)}${u.email ? ' · ' + escapeHTML(u.email) : ''}</span></div>
        <div class="row-actions">
          <button class="icon-btn" data-edit-user="${u.id}">${icon('edit')}</button>
          <button class="icon-btn danger" data-del-user="${u.id}">${icon('trash')}</button>
        </div>
      </div>`).join('')
    : '<p class="empty-hint">Nenhum usuário cadastrado.</p>';
  wrap.querySelectorAll('[data-edit-user]').forEach(btn => btn.addEventListener('click', () => abrirModalUsuario(btn.dataset.editUser)));
  wrap.querySelectorAll('[data-del-user]').forEach(btn => btn.addEventListener('click', () => excluirUsuario(btn.dataset.delUser)));
}

function formUsuarioHTML(usuario) {
  const u = usuario || {};
  const isEdit = !!usuario;
  return `
    <h3>${isEdit ? 'Editar usuário' : 'Novo usuário'}</h3>
    <div class="form-grid">
      <label class="field"><span>Nome</span><input type="text" id="f-user-nome" value="${escapeHTML(u.nome || '')}"></label>
      <label class="field"><span>Sobrenome</span><input type="text" id="f-user-sobrenome" value="${escapeHTML(u.sobrenome || '')}"></label>
      <label class="field wide"><span>E-mail (para recuperação de senha)</span><input type="email" id="f-user-email" value="${escapeHTML(u.email || '')}"></label>
      <label class="field"><span>${isEdit ? 'Nova senha (opcional)' : 'Senha'}</span><input type="password" id="f-user-senha"></label>
      <label class="field"><span>Confirmar senha</span><input type="password" id="f-user-senha2"></label>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-salvar-usuario">${isEdit ? 'Salvar alterações' : 'Cadastrar usuário'}</button>
      <button class="btn btn-ghost" id="btn-cancelar-usuario">Cancelar</button>
    </div>`;
}

function abrirModalUsuario(id) {
  const db = getDB();
  const usuario = id ? db.usuarios.find(u => u.id === id) : null;
  openModal(formUsuarioHTML(usuario));
  document.getElementById('btn-salvar-usuario').addEventListener('click', () => salvarUsuario(id));
  document.getElementById('btn-cancelar-usuario').addEventListener('click', closeModal);
}

async function salvarUsuario(id) {
  const nome = document.getElementById('f-user-nome').value.trim();
  const sobrenome = document.getElementById('f-user-sobrenome').value.trim();
  const email = document.getElementById('f-user-email').value.trim();
  const senha = document.getElementById('f-user-senha').value;
  const senha2 = document.getElementById('f-user-senha2').value;
  if (!nome || !sobrenome) { toast('Informe nome e sobrenome', 'error'); return; }
  if (senha && senha !== senha2) { toast('As senhas não coincidem', 'error'); return; }
  if (!id && senha.length < 4) { toast('A senha deve ter pelo menos 4 caracteres', 'error'); return; }
  const db = getDB();
  if (id) {
    const usuario = db.usuarios.find(u => u.id === id);
    usuario.nome = nome; usuario.sobrenome = sobrenome; usuario.email = email;
    if (senha) usuario.senhaHash = await hashSenha(senha);
    registrarLog(db, 'Usuário editado', { Usuário: `${nome} ${sobrenome}` });
    saveDB(db);
    toast('Usuário atualizado');
    const atual = getUsuarioLogado();
    if (atual && atual.id === id) {
      document.getElementById('sidebar-user-name').textContent = `${nome} ${sobrenome}`;
    }
  } else {
    const username = gerarUsernameUnico(db, nome, sobrenome);
    const usuario = { id: uid(), nome, sobrenome, username, email, senhaHash: await hashSenha(senha), criadoEm: new Date().toISOString() };
    db.usuarios.push(usuario);
    registrarLog(db, 'Usuário criado', { Usuário: `${nome} ${sobrenome}`, Login: username });
    saveDB(db);
    toast(`Usuário criado — login: ${username}`);
  }
  closeModal();
  renderUsuariosLista();
}

function excluirUsuario(id) {
  const db = getDB();
  const atual = getUsuarioLogado();
  if (atual && atual.id === id) { toast('Você não pode excluir o usuário com que está conectado', 'error'); return; }
  if (db.usuarios.length <= 1) { toast('É preciso manter ao menos um usuário', 'error'); return; }
  if (!confirm('Excluir este usuário?')) return;
  const usuario = db.usuarios.find(u => u.id === id);
  db.usuarios = db.usuarios.filter(u => u.id !== id);
  registrarLog(db, 'Usuário excluído', { Usuário: usuario ? `${usuario.nome} ${usuario.sobrenome}` : id });
  saveDB(db);
  renderUsuariosLista();
  toast('Usuário excluído');
}

document.addEventListener('DOMContentLoaded', initUsuarios);
