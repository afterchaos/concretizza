document.addEventListener("DOMContentLoaded", () => {
  verificarAutenticacao()
  carregarDadosUsuario()
  inicializarPagina()
})

function verificarAutenticacao() {
  const token = localStorage.getItem("token")
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"))
  if (!token || !usuarioLogado) {
    window.location.href = "/"
    return
  }
}

function carregarDadosUsuario() {
  const usuarioLogado = obterUsuarioLogado()
  if (usuarioLogado) {
    const userNameElement = document.getElementById("userName")
    const userRoleElement = document.getElementById("userRole")

    if (userNameElement) {
      userNameElement.textContent = usuarioLogado.nome || usuarioLogado.username
    }

    if (userRoleElement) {
      userRoleElement.textContent = formatarCargo(usuarioLogado.cargo)
    }

    // Configure admin section
    configurarAdminSection()

    // Check permissions for viewing links
    if (!podeVisualizarTudo('links')) {
      mostrarToast("Você não tem permissão para acessar esta página", "erro")
      window.location.href = "/dashboard"
      return
    }

    // Show "Novo Link" button based on permissions
    const btnNovo = document.getElementById("btnNovoLink")
    if (btnNovo) {
      btnNovo.style.display = podeCriar('links') ? "inline-block" : "none"
    }
  }
}

function formatarCargo(cargo) {
  if (!cargo) return ""
  const cargos = cargo.split(',').map(c => c.trim())
  const map = {
    "head-admin": "Head Admin",
    admin: "Administrador",
    corretor: "Corretor",
    visualizar: "Visualizar"
  }
  return cargos.map(c => map[c.toLowerCase()] || c).join(", ")
}

let links = []
let corretores = []
let linkEmEdicao = null

async function inicializarPagina() {
  configurarEventos()
  await Promise.all([
    carregarCorretores(),
    carregarLinks()
  ])
  atualizarEstatisticas()
}

async function carregarCorretores() {
  try {
    const response = await fetch('/api/corretores', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    if (response.ok) {
      corretores = await response.json()
      popularSelectCorretores()
    } else {
      console.error("Erro ao carregar corretores:", response.status)
    }
  } catch (error) {
    console.error("Erro ao carregar corretores:", error)
  }
}

async function carregarLinks() {
  try {
    const usuarioLogado = obterUsuarioLogado()
    let url = '/api/corretores/links'

    // Se for corretor (não admin), carregar apenas seus links
    if (usuarioLogado && usuarioLogado.cargo && !isAdminOrHeadAdmin()) {
      const cargos = usuarioLogado.cargo.split(',').map(c => c.trim().toLowerCase())
      if (cargos.includes('corretor')) {
        // Assumindo que o usuário tem um campo corretor_id ou id que corresponde ao corretor
        // Se o usuário for corretor, usar seu ID para filtrar
        if (usuarioLogado.corretor_id) {
          url = `/api/corretores/${usuarioLogado.corretor_id}/links`
        }
      }
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    if (response.ok) {
      links = await response.json()
      renderizarTabelaLinks()
    } else {
      console.error("Erro ao carregar links:", response.status)
    }
  } catch (error) {
    console.error("Erro ao carregar links:", error)
    mostrarToast("Erro ao carregar links", "erro")
  }
}

function popularSelectCorretores() {
  const container = document.getElementById("corretoresContainer")
  const filterCorretor = document.getElementById("filterCorretor")
  const usuarioLogado = obterUsuarioLogado()
  const isCorretorOnly = usuarioLogado && usuarioLogado.cargo &&
                        !isAdminOrHeadAdmin() &&
                        usuarioLogado.cargo.split(',').map(c => c.trim().toLowerCase()).includes('corretor')

  if (container) {
    container.innerHTML = ''

    // Se for apenas corretor, mostrar apenas ele mesmo
    if (isCorretorOnly && usuarioLogado.corretor_id) {
      const corretorUsuario = corretores.find(c => c.id == usuarioLogado.corretor_id)
      if (corretorUsuario) {
        const itemDiv = document.createElement("div")
        itemDiv.className = "corretor-checkbox-item"

        const checkbox = document.createElement("input")
        checkbox.type = "checkbox"
        checkbox.id = `corretor-${corretorUsuario.id}`
        checkbox.value = corretorUsuario.id
        checkbox.checked = true
        checkbox.disabled = true // Não permitir mudança

        const label = document.createElement("label")
        label.htmlFor = `corretor-${corretorUsuario.id}`
        label.textContent = corretorUsuario.nome

        itemDiv.appendChild(checkbox)
        itemDiv.appendChild(label)
        container.appendChild(itemDiv)
      }
    } else {
      // Admins podem escolher qualquer corretor
      corretores.forEach(corretor => {
        const itemDiv = document.createElement("div")
        itemDiv.className = "corretor-checkbox-item"

        const checkbox = document.createElement("input")
        checkbox.type = "checkbox"
        checkbox.id = `corretor-${corretor.id}`
        checkbox.value = corretor.id

        const label = document.createElement("label")
        label.htmlFor = `corretor-${corretor.id}`
        label.textContent = corretor.nome

        itemDiv.appendChild(checkbox)
        itemDiv.appendChild(label)
        container.appendChild(itemDiv)
      })
    }
  }

  if (filterCorretor) {
    filterCorretor.innerHTML = '<option value="">Todos os corretores</option>'

    // Se for apenas corretor, não mostrar filtro de corretores (já filtra automaticamente)
    if (!isCorretorOnly) {
      corretores.forEach(corretor => {
        const option = document.createElement("option")
        option.value = corretor.id
        option.textContent = corretor.nome
        filterCorretor.appendChild(option)
      })
    } else {
      filterCorretor.style.display = 'none' // Esconder filtro para corretores
    }
  }
}

function renderizarTabelaLinks() {
  const tbody = document.getElementById("linksTable")
  const termoBusca = document.getElementById("searchLinks").value.toLowerCase()
  const filtroCorretor = document.getElementById("filterCorretor").value

  const canEdit = podeEditar('links')

  // Hide/show "Ações" column header based on permissions
  const headerAcoes = document.getElementById("headerAcoesLinks")
  if (headerAcoes) {
    headerAcoes.style.display = canEdit ? "table-cell" : "none"
  }

  let filtrados = links.filter(link => {
    const corretorNome = link.corretores_nomes?.toLowerCase() || ''
    const titulo = link.titulo?.toLowerCase() || ''
    const url = link.url?.toLowerCase() || ''
    const descricao = link.descricao?.toLowerCase() || ''

    const matchBusca = corretorNome.includes(termoBusca) ||
                       titulo.includes(termoBusca) ||
                       url.includes(termoBusca) ||
                       descricao.includes(termoBusca)

    // Note: Filtering by specific broker is disabled since links can now have multiple brokers
    // The search will still work on broker names in the corretores_nomes field

    return matchBusca
  })

  // Ordenar por data de criação (mais recente primeiro)
  filtrados.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))

  const colspan = canEdit ? 6 : 5
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">Nenhum link encontrado</td></tr>`
    return
  }

  tbody.innerHTML = filtrados.map(link => `
    <tr onclick="abrirDetalhesLink(${link.id})" style="cursor: pointer;">
      <td onclick="event.stopPropagation();">
        <input type="checkbox" class="checkbox-input link-checkbox" data-id="${link.id}">
      </td>
      <td>${link.titulo}</td>
      <td>${formatarData(link.criado_em)}</td>
      <td>${link.criado_por_nome || '-'}</td>
      ${canEdit ? `<td onclick="event.stopPropagation();">
        <button class="btn-action btn-edit" onclick="editarLink(${link.id})" title="Editar">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn-action btn-delete" onclick="excluirLink(${link.id})" title="Excluir">
          <i class="fas fa-trash"></i> Excluir
        </button>
      </td>` : ''}
    </tr>
  `).join('')

  // Add checkbox listeners after rendering
  adicionarListenersCheckboxesLinks()
}

function atualizarEstatisticas() {
  const totalLinks = links.length
  // Since links can now have multiple brokers, count unique brokers across all assignments
  const allCorretores = new Set()
  links.forEach(link => {
    if (link.corretores_nomes) {
      link.corretores_nomes.split(', ').forEach(nome => allCorretores.add(nome.trim()))
    }
  })
  const corretoresComLinks = allCorretores.size

  // Links recentes (últimos 30 dias)
  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
  const linksRecentes = links.filter(link => new Date(link.criado_em) >= trintaDiasAtras).length

  // Links mais acessados - por enquanto, calcular baseado em corretores únicos ou algo simples
  // Futuramente pode ser implementado com contadores de acesso reais
  const linksAcessados = Math.floor(totalLinks * 0.3) || 0 // Simula 30% dos links sendo "mais acessados"

  document.getElementById("totalLinks").textContent = totalLinks
  document.getElementById("totalCorretoresComLinks").textContent = corretoresComLinks
  document.getElementById("linksRecentes").textContent = linksRecentes
  document.getElementById("linksAcessados").textContent = linksAcessados
}

function configurarEventos() {
  // Sidebar toggle
  const sidebarToggle = document.getElementById("sidebarToggleMobile")
  const sidebar = document.querySelector(".sidebar")
  const sidebarClose = document.getElementById("sidebarToggle")

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.add("active")
    })
  }

  if (sidebarClose) {
    sidebarClose.addEventListener("click", () => {
      sidebar.classList.remove("active")
    })
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      document.getElementById("modalConfirmacaoLogout").classList.add("show")
    })
  }

  const closeConfirmacaoLogout = document.getElementById("closeConfirmacaoLogout")
  if (closeConfirmacaoLogout) {
    closeConfirmacaoLogout.addEventListener("click", () => {
      document.getElementById("modalConfirmacaoLogout").classList.remove("show")
    })
  }

  const btnCancelarLogout = document.getElementById("btnCancelarLogout")
  if (btnCancelarLogout) {
    btnCancelarLogout.addEventListener("click", () => {
      document.getElementById("modalConfirmacaoLogout").classList.remove("show")
    })
  }

  const btnConfirmarLogout = document.getElementById("btnConfirmarLogout")
  if (btnConfirmarLogout) {
    btnConfirmarLogout.addEventListener("click", fazerLogout)
  }

  // Novo Link button
  const btnNovoLink = document.getElementById("btnNovoLink")
  if (btnNovoLink) {
    btnNovoLink.addEventListener("click", () => {
      if (!podeCriar('links')) {
        mostrarToast("Você não tem permissão para criar links", "erro")
        return
      }

      linkEmEdicao = null
      document.getElementById("formLink").reset()
      document.getElementById("modalLinkTitle").textContent = "Novo Link"
      document.getElementById("modalLink").classList.add("show")
    })
  }

  // Modal Link
  const modalLink = document.getElementById("modalLink")
  const closeModalLink = document.getElementById("closeModalLink")
  const cancelBtnLink = modalLink?.querySelector(".modal-close-btn")

  if (closeModalLink) {
    closeModalLink.addEventListener("click", () => {
      modalLink.classList.remove("show")
      modalLink.style.display = ""
    })
  }

  if (cancelBtnLink) {
    cancelBtnLink.addEventListener("click", () => {
      modalLink.classList.remove("show")
      modalLink.style.display = ""
    })
  }

  // Form Link submit
  const formLink = document.getElementById("formLink")
  if (formLink) {
    formLink.addEventListener("submit", async (e) => {
      e.preventDefault()
      await salvarLink()
    })
  }

  // Filters
  const searchLinks = document.getElementById("searchLinks")
  const filterCorretor = document.getElementById("filterCorretor")

  if (searchLinks) {
    searchLinks.addEventListener("input", () => {
      renderizarTabelaLinks()
    })
  }

  if (filterCorretor) {
    filterCorretor.addEventListener("change", () => {
      renderizarTabelaLinks()
    })
  }

  // Checkbox handling
  const selectAll = document.getElementById("selectAll")
  if (selectAll) {
    selectAll.addEventListener("change", (e) => {
      const checkboxes = document.querySelectorAll(".link-checkbox")
      checkboxes.forEach((checkbox) => {
        checkbox.checked = e.target.checked
      })
      atualizarLinksSelecionados()
    })
  }

  // Bulk actions
  const btnExcluirSelecionados = document.getElementById("btnExcluirSelecionados")
  if (btnExcluirSelecionados) {
    btnExcluirSelecionados.addEventListener("click", () => {
      confirmarExclusaoMassa()
    })
  }

  // Modal confirmations
  const closeConfirmacao = document.getElementById("closeConfirmacao")
  const btnCancelarExclusao = document.getElementById("btnCancelarExclusao")
  const btnConfirmarExclusao = document.getElementById("btnConfirmarExclusao")

  if (closeConfirmacao) {
    closeConfirmacao.addEventListener("click", () => {
      document.getElementById("modalConfirmacao").style.display = "none"
    })
  }

  if (btnCancelarExclusao) {
    btnCancelarExclusao.addEventListener("click", () => {
      document.getElementById("modalConfirmacao").style.display = "none"
    })
  }

  if (btnConfirmarExclusao) {
    btnConfirmarExclusao.addEventListener("click", () => {
      executarExclusaoIndividual()
    })
  }

  // Modal bulk confirmation
  const closeConfirmacaoMassa = document.getElementById("closeConfirmacaoMassa")
  const btnCancelarExclusaoMassa = document.getElementById("btnCancelarExclusaoMassa")
  const btnConfirmarExclusaoMassa = document.getElementById("btnConfirmarExclusaoMassa")

  if (closeConfirmacaoMassa) {
    closeConfirmacaoMassa.addEventListener("click", () => {
      document.getElementById("modalConfirmacaoMassa").style.display = "none"
    })
  }

  if (btnCancelarExclusaoMassa) {
    btnCancelarExclusaoMassa.addEventListener("click", () => {
      document.getElementById("modalConfirmacaoMassa").style.display = "none"
    })
  }

  if (btnConfirmarExclusaoMassa) {
    btnConfirmarExclusaoMassa.addEventListener("click", () => {
      executarExclusaoMassa()
    })
  }

  // Modal de detalhes do link
  const closeDetailsModal = document.getElementById("closeDetailsModal")
  const btnFecharDetalhes = document.getElementById("btnFecharDetalhes")

  if (closeDetailsModal) {
    closeDetailsModal.addEventListener("click", () => {
      document.getElementById("modalDetalhesLink").classList.remove("show")
      document.getElementById("modalDetalhesLink").style.display = "none"
    })
  }

  if (btnFecharDetalhes) {
    btnFecharDetalhes.addEventListener("click", () => {
      document.getElementById("modalDetalhesLink").classList.remove("show")
      document.getElementById("modalDetalhesLink").style.display = "none"
    })
  }

  // Fechar modal ao clicar fora
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none"
      e.target.classList.remove("show")
      e.target.classList.remove("active")
    }
  })

  // Impedir fechamento do modal ao clicar no conteúdo
  const modalContents = document.querySelectorAll(".modal-content")
  modalContents.forEach((content) => {
    content.addEventListener("click", (e) => {
      e.stopPropagation()
    })
  })
}

async function salvarLink() {
  if (!podeEditar('links')) {
    mostrarToast("Você não tem permissão para gerenciar links", "erro")
    return
  }

  // Coletar corretores selecionados dos checkboxes
  const checkboxes = document.querySelectorAll('#corretoresContainer input[type="checkbox"]:not(:disabled)')
  const corretorIds = Array.from(checkboxes)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => parseInt(checkbox.value))

  const dadosLink = {
    corretor_ids: corretorIds,
    titulo: document.getElementById("linkTitulo").value.trim(),
    url: document.getElementById("linkUrl").value.trim(),
    descricao: document.getElementById("linkDescricao").value.trim() || null
  }

  if (corretorIds.length === 0 || !dadosLink.titulo || !dadosLink.url) {
    mostrarToast("Preencha todos os campos obrigatórios", "erro")
    return
  }

  // Validar URL
  try {
    new URL(dadosLink.url)
  } catch (error) {
    mostrarToast("URL inválida", "erro")
    return
  }

  try {
    let response
    if (linkEmEdicao) {
      // For editing, we'll keep the old endpoint for now (single broker edit)
      // In a full implementation, we'd need to update the assignments
      const linkAtual = links.find(l => l.id === linkEmEdicao)
      if (linkAtual) {
        dadosLink.corretor_id = corretorIds[0] // Take first for editing
        response = await fetch(`/api/corretores/links/${linkEmEdicao}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(dadosLink)
        })
      }
    } else {
      response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(dadosLink)
      })
    }

    if (response.ok) {
      mostrarToast(linkEmEdicao ? "Link atualizado com sucesso!" : "Link criado com sucesso!", "sucesso")
      document.getElementById("modalLink").classList.remove("show")
      await carregarLinks()
      atualizarEstatisticas()
    } else {
      const error = await response.json()
      mostrarToast("Erro: " + (error.error || "Erro desconhecido"), "erro")
    }
  } catch (error) {
    console.error("Erro ao salvar link:", error)
    mostrarToast("Erro ao salvar link", "erro")
  }
}

// Expose functions to global scope for onclick handlers
window.editarLink = function(id) {
  if (!podeEditar('links')) {
    mostrarToast("Você não tem permissão para editar links", "erro")
    return
  }

  const link = links.find(l => l.id === id)
  if (!link) return

  linkEmEdicao = id

  // Para edição, por enquanto mantemos compatibilidade com links antigos (único corretor)
  // Futuramente implementar edição completa de múltiplos corretores
  const checkboxes = document.querySelectorAll('#corretoresContainer input[type="checkbox"]:not(:disabled)')
  checkboxes.forEach(checkbox => {
    checkbox.checked = false // Limpar seleções anteriores
  })

  // Selecionar o corretor associado ao link (compatibilidade com links antigos)
  if (link.corretor_id) {
    const checkbox = document.getElementById(`corretor-${link.corretor_id}`)
    if (checkbox) checkbox.checked = true
  }

  document.getElementById("linkTitulo").value = link.titulo
  document.getElementById("linkUrl").value = link.url
  document.getElementById("linkDescricao").value = link.descricao || ""

  document.getElementById("modalLinkTitle").textContent = "Editar Link"
  document.getElementById("modalLink").classList.add("show")
}

window.excluirLink = function(id) {
  if (!podeDeletar('links')) {
    mostrarToast("Você não tem permissão para excluir links", "erro")
    return
  }

  confirmarExclusaoIndividual(id)
}

function formatarData(data) {
  if (!data) return "-"
  let dateString = data
  if (typeof data === 'string') {
    dateString = data.replace(' ', 'T')
    if (!dateString.includes('T')) {
      dateString += 'T12:00:00'
    }
  }
  const d = new Date(dateString)
  if (isNaN(d.getTime())) {
    return "Data inválida"
  }
  return d.toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo' })
}

let linksSelecionados = []

function atualizarLinksSelecionados() {
  const checkboxes = document.querySelectorAll(".link-checkbox")
  linksSelecionados = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => parseInt(cb.getAttribute("data-id")))

  const bulkActions = document.getElementById("bulkActions")
  const selectedCount = document.getElementById("selectedCount")

  if (linksSelecionados.length > 0) {
    bulkActions.style.display = "flex"
    selectedCount.textContent = `${linksSelecionados.length} link(s) selecionado(s)`
  } else {
    bulkActions.style.display = "none"
  }
}

function adicionarListenersCheckboxesLinks() {
  const checkboxes = document.querySelectorAll(".link-checkbox")
  checkboxes.forEach(checkbox => {
    checkbox.removeEventListener("change", atualizarLinksSelecionados)
    checkbox.addEventListener("change", atualizarLinksSelecionados)
  })
}

function confirmarExclusaoMassa() {
  if (linksSelecionados.length === 0) {
    mostrarToast("Nenhum link selecionado", "aviso")
    return
  }

  const quantidade = linksSelecionados.length
  document.getElementById("quantidadeLinksExcluir").textContent = quantidade

  // Criar lista dos links selecionados
  const listaContainer = document.getElementById("listaLinksExcluir")
  listaContainer.innerHTML = ""

  linksSelecionados.forEach(id => {
    const link = links.find(l => l.id === id)
    if (link) {
      const item = document.createElement("div")
      item.className = "bulk-client-item"
      item.textContent = `"${link.titulo}" - ${link.corretores_nomes || 'Corretor não encontrado'}`
      listaContainer.appendChild(item)
    }
  })

  document.getElementById("modalConfirmacaoMassa").style.display = "flex"
}

async function executarExclusaoMassa() {
  if (linksSelecionados.length === 0) {
    mostrarToast("Nenhum link selecionado", "aviso")
    return
  }

  const btnConfirmar = document.getElementById("btnConfirmarExclusaoMassa")
  try {
    btnConfirmar.disabled = true
    btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...'

    for (const id of linksSelecionados) {
      await fetch(`/api/corretores/links/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
    }

    document.getElementById("modalConfirmacaoMassa").style.display = "none"
    mostrarToast(`${linksSelecionados.length} link(s) excluído(s) com sucesso!`, "sucesso")

    // Limpar seleção
    linksSelecionados = []
    const checkboxes = document.querySelectorAll(".link-checkbox")
    checkboxes.forEach(cb => cb.checked = false)
    atualizarLinksSelecionados()

    await carregarLinks()
    atualizarEstatisticas()

  } catch (error) {
    console.error("Erro ao excluir links:", error)
    mostrarToast("Erro ao excluir links: " + error.message, "erro")
  } finally {
    btnConfirmar.disabled = false
    btnConfirmar.innerHTML = '<i class="fas fa-trash"></i> Confirmar Exclusão'
  }
}

let linkParaExcluir = null
let linkParaVer = null

// Expose functions to global scope for onclick handlers
window.abrirDetalhesLink = function(id) {
  const link = links.find(l => l.id === id)
  if (!link) return

  linkParaVer = link

  // Preencher informações
  document.getElementById("modalDetailsTitle").textContent = `Detalhes do Link: ${link.titulo}`
  document.getElementById("detailLinkTitulo").textContent = link.titulo
  document.getElementById("detailLinkDataCriacao").textContent = formatarData(link.criado_em)
  document.getElementById("detailLinkCriadoPor").textContent = link.criado_por_nome || "-"

  // Link de acesso
  const linkAcesso = document.getElementById("detailLinkAcesso")
  linkAcesso.href = link.url
  linkAcesso.textContent = "Abrir link"

  // Descrição
  document.getElementById("detailLinkDescricao").textContent = link.descricao || "Sem descrição"

  // Configurar botão de editar baseado em permissões
  const btnEditarDetalhes = document.getElementById("btnEditarDetalhes")
  if (btnEditarDetalhes) {
    btnEditarDetalhes.style.display = podeEditar('links') ? "" : "none"
    btnEditarDetalhes.onclick = () => {
      document.getElementById("modalDetalhesLink").style.display = "none"
      editarLink(link.id)
    }
  }

  // Mostrar modal
  document.getElementById("modalDetalhesLink").classList.add("show")
}

function confirmarExclusaoIndividual(id) {
  const link = links.find(l => l.id === id)
  if (!link) return

  linkParaExcluir = id
  document.getElementById("nomeLinkExcluir").textContent = `"${link.titulo}"`
  document.getElementById("modalConfirmacao").style.display = "flex"
}

async function executarExclusaoIndividual() {
  if (!linkParaExcluir) return

  const btnConfirmar = document.getElementById("btnConfirmarExclusao")
  try {
    btnConfirmar.disabled = true
    btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...'

    const response = await fetch(`/api/corretores/links/${linkParaExcluir}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (response.ok) {
      document.getElementById("modalConfirmacao").style.display = "none"
      mostrarToast("Link excluído com sucesso!", "sucesso")
      await carregarLinks()
      atualizarEstatisticas()
    } else {
      const error = await response.json()
      throw new Error(error.error || "Erro ao excluir link")
    }

  } catch (error) {
    console.error("Erro ao excluir link:", error)
    mostrarToast("Erro ao excluir link: " + error.message, "erro")
  } finally {
    btnConfirmar.disabled = false
    btnConfirmar.innerHTML = '<i class="fas fa-trash"></i> Confirmar Exclusão'
    linkParaExcluir = null
  }
}

function mostrarToast(mensagem, tipo = "info") {
  const toast = document.getElementById("toastNotification")
  let icon = "info-circle"

  if (tipo === "sucesso") icon = "check-circle"
  if (tipo === "erro") icon = "exclamation-circle"
  if (tipo === "aviso") icon = "exclamation-triangle"

  toast.className = `toast toast-${tipo} show`
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-${icon}"></i>
      <span>${mensagem}</span>
    </div>
  `

  setTimeout(() => {
    toast.classList.remove("show")
  }, 3000)
}
