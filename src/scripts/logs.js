let logs = []
let paginaAtual = 1
const itensPorPagina = 15

document.addEventListener("DOMContentLoaded", () => {
  verificarAutenticacao()
  carregarDadosUsuario()
  carregarLogs()
  configurarEventos()
})

function verificarAutenticacao() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"))
  if (!usuarioLogado || !isAdminOrHeadAdmin()) {
    window.location.href = "dashboard.html"
    return
  }
}

function carregarDadosUsuario() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"))
  if (usuarioLogado) {
    const userNameElement = document.getElementById("userName")
    const userRoleElement = document.getElementById("userRole")

    if (userNameElement) {
      userNameElement.textContent = usuarioLogado.nome || usuarioLogado.username
    }

    if (userRoleElement) {
      userRoleElement.textContent = formatarCargo(usuarioLogado.cargo)
    }
  }
}

function carregarLogs() {
  logs = obterLogs().reverse()
  atualizarTabela()
  atualizarEstatisticas()
}

function atualizarEstatisticas() {
  const totalLogs = logs.length
  const logsHoje = logs.filter(l => l.dataFormatada === new Date().toLocaleDateString('pt-BR')).length

  document.getElementById("totalLogs").textContent = totalLogs
  document.getElementById("logsHoje").textContent = logsHoje
}

function atualizarTabela() {
  const tbody = document.getElementById("logsTable")
  const logsFiltrados = filtrarLogs()

  const inicio = (paginaAtual - 1) * itensPorPagina
  const fim = inicio + itensPorPagina
  const logsPagina = logsFiltrados.slice(inicio, fim)

  if (logsPagina.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum log encontrado</td></tr>'
  } else {
    tbody.innerHTML = logsPagina
      .map(
        (log) => `
      <tr>
        <td><strong>${log.acao}</strong></td>
        <td>${log.modulo}</td>
        <td>${log.dataFormatada} ${log.horaFormatada}</td>
        <td>${log.usuarioLogado}</td>
        <td>${log.usuarioAfetado || '-'}</td>
        <td class="log-descricao">${log.descricao}</td>
      </tr>
    `,
      )
      .join("")
  }

  atualizarPaginacao(logsFiltrados.length)
}

function atualizarPaginacao(total) {
  const totalPaginas = Math.ceil(total / itensPorPagina)
  document.getElementById("pageInfo").textContent = `Página ${paginaAtual} de ${totalPaginas}`
  document.getElementById("prevPage").disabled = paginaAtual === 1
  document.getElementById("nextPage").disabled = paginaAtual === totalPaginas
}

function filtrarLogs() {
  const searchValue = (document.getElementById("searchLogs")?.value || "").toLowerCase()
  const acaoValue = document.getElementById("filterAcao")?.value || ""

  return logs.filter(log => {
    const searchMatch =
      log.acao.toLowerCase().includes(searchValue) ||
      log.modulo.toLowerCase().includes(searchValue) ||
      log.usuarioLogado.toLowerCase().includes(searchValue) ||
      (log.usuarioAfetado?.toLowerCase().includes(searchValue) || false) ||
      log.descricao.toLowerCase().includes(searchValue)

    const acaoMatch = acaoValue === "" || log.acao === acaoValue

    return searchMatch && acaoMatch
  })
}

function configurarEventos() {
  const sidebarToggle = document.getElementById("sidebarToggleMobile")
  const sidebar = document.querySelector(".sidebar")

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active")
    })
  }

  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault()
      if (confirm("Deseja realmente sair?")) {
        localStorage.removeItem("usuarioLogado")
        window.location.href = "index.html"
      }
    })
  }

  document.getElementById("searchLogs")?.addEventListener("input", () => {
    paginaAtual = 1
    atualizarTabela()
  })

  document.getElementById("filterAcao")?.addEventListener("change", () => {
    paginaAtual = 1
    atualizarTabela()
  })

  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (paginaAtual > 1) {
      paginaAtual--
      atualizarTabela()
    }
  })

  document.getElementById("nextPage")?.addEventListener("click", () => {
    const logsFiltrados = filtrarLogs()
    const totalPaginas = Math.ceil(logsFiltrados.length / itensPorPagina)
    if (paginaAtual < totalPaginas) {
      paginaAtual++
      atualizarTabela()
    }
  })

  document.getElementById("btnExportarLogs")?.addEventListener("click", exportarLogs)

  document.getElementById("btnLimparLogs")?.addEventListener("click", () => {
    if (confirm("⚠️ Tem certeza? Esta ação não pode ser desfeita!")) {
      limparLogs()
      registrarLog("LIMPAR_LOGS", "logs", "Todos os logs foram limpos")
      carregarLogs()
      mostrarNotificacao("Logs limpos com sucesso!")
    }
  })
}

function mostrarNotificacao(mensagem) {
  const toast = document.getElementById("toastNotification")
  if (toast) {
    toast.textContent = mensagem
    toast.style.display = "block"
    toast.style.opacity = "1"

    setTimeout(() => {
      toast.style.display = "none"
    }, 3000)
  }
}
