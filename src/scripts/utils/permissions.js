const PERMISSIONS = {
  'head-admin': {
    clientes: ['create', 'read', 'update', 'delete'],
    usuarios: ['create', 'read', 'update', 'delete', 'manage-admins'],
    logs: ['read'],
  },
  admin: {
    clientes: ['create', 'read', 'update', 'delete'],
    usuarios: ['read'],
    logs: ['read'],
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

function isHeadAdmin() {
  const usuario = obterUsuarioLogado()
  return usuario?.cargo?.toLowerCase() === 'head-admin'
}

function isAdminOrHeadAdmin() {
  const usuario = obterUsuarioLogado()
  const cargo = usuario?.cargo?.toLowerCase()
  return cargo === 'admin' || cargo === 'head-admin'
}

function bloqueado(mensagem = 'Você não tem permissão para realizar esta ação') {
  alert(mensagem)
  return false
}

function formatarCargo(cargo) {
  if (!cargo) return 'User'
  const cargoLower = cargo.toLowerCase()
  
  const mapeamento = {
    'head-admin': 'Head-Admin',
    'admin': 'Admin',
    'editor': 'Editor',
    'visualizar': 'Visualizar',
    'visualizador': 'Visualizar',
    'user': 'User'
  }
  
  return mapeamento[cargoLower] || (cargo.charAt(0).toUpperCase() + cargo.slice(1))
}

function formatarPermissao(permissao) {
  return formatarCargo(permissao)
}
