function mostrarNotificacao(mensagem, tipo = 'info', duracao = 4000) {
  const container = document.getElementById("toastNotification")
  if (!container) return

  container.innerHTML = ''
  container.className = `toast toast-${tipo}`
  
  const icones = {
    sucesso: 'fa-check-circle',
    erro: 'fa-exclamation-circle',
    aviso: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  }
  
  const icone = icones[tipo] || icones.info
  
  container.innerHTML = `
    <div class="toast-content">
      <i class="fas ${icone}"></i>
      <span>${mensagem}</span>
    </div>
  `
  
  container.style.display = 'flex'
  
  if (duracao > 0) {
    setTimeout(() => {
      container.style.display = 'none'
    }, duracao)
  }
}

function obterUsuarioLogado() {
  const usuarioStr = localStorage.getItem("usuarioLogado")
  return usuarioStr ? JSON.parse(usuarioStr) : null
}

function obterPermissao(usuario, recurso, acao) {
  if (!usuario) return false
  
  const cargo = usuario.cargo?.toLowerCase()
  
  if (cargo === "head-admin") return true
  
  if (cargo === "admin") {
    if (recurso === "usuarios" && acao === "delete") return true
    if (recurso === "usuarios" && acao === "update") return true
    if (recurso === "clientes") return true
  }
  
  if (cargo === "editor") {
    if (recurso === "clientes" && (acao === "create" || acao === "update")) return true
  }
  
  if (cargo === "visualizar" || cargo === "visualizador") {
    if (acao === "read") return true
  }
  
  return false
}
