const PERMISSIONS = {
  admin: {
    clientes: ['create', 'read', 'update', 'delete'],
    usuarios: ['create', 'read', 'update', 'delete'],
  },
  editor: {
    clientes: ['create', 'read', 'update', 'delete'],
    usuarios: ['read'],
  },
  visualizar: {
    clientes: ['read'],
    usuarios: [],
  },
}

function obterUsuarioLogado() {
  return JSON.parse(localStorage.getItem('usuarioLogado'))
}

function obterPermissao(usuario, modulo, acao) {
  if (!usuario || !usuario.cargo) return false
  const perms = PERMISSIONS[usuario.cargo.toLowerCase()]
  if (!perms) return false
  return perms[modulo]?.includes(acao) || false
}

function podeEditar(modulo = 'clientes') {
  const usuario = obterUsuarioLogado()
  return obterPermissao(usuario, modulo, 'update')
}

function podeVisualizarTudo(modulo = 'clientes') {
  const usuario = obterUsuarioLogado()
  return obterPermissao(usuario, modulo, 'read')
}

function podeCriar(modulo = 'clientes') {
  const usuario = obterUsuarioLogado()
  return obterPermissao(usuario, modulo, 'create')
}

function podeDeletar(modulo = 'clientes') {
  const usuario = obterUsuarioLogado()
  return obterPermissao(usuario, modulo, 'delete')
}

function isAdmin() {
  const usuario = obterUsuarioLogado()
  return usuario?.cargo?.toLowerCase() === 'admin'
}

function bloqueado(mensagem = 'Você não tem permissão para realizar esta ação') {
  alert(mensagem)
  return false
}
