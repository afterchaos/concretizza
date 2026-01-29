document.addEventListener("DOMContentLoaded", () => {
  verificarAutenticacao()
  configurarDadosUsuario()
  carregarClientes()
  configurarEventos()
  aplicarPermissoes()
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

    const adminSection = document.getElementById("adminSection")
    if (adminSection) {
      if (isAdminOrHeadAdmin()) {
        adminSection.style.display = "block"
      } else {
        adminSection.style.display = "none"
      }
    }
  }
}

let currentPage = 1
let clientes = []
let clientesFiltrados = []
let itensPorPagina = 10
let clienteEmEdicao = null
let clienteParaVer = null
let clientesSelecionados = []
let corretores = []
let currentSortIndex = 0
let clienteOriginalData = null // Store original client data for comparison
let sortOptions = [
  {value: "", label: "Padrão"},
  {value: "nome", label: "Alfabética"},
  {value: "data_atribuicao", label: "Data de Atribuição"},
  {value: "atualizado_em", label: "Última Modificação"}
]
window.currentSortValue = ""

async function carregarClientes() {
  try {
    mostrarCarregando(true)
    const resultado = await obterClientes()

    // Garantir que clientes seja sempre um array
    clientes = Array.isArray(resultado) ? resultado : []
    await carregarCorretores()
    populateSelectAtribuicao()
    clientesFiltrados = [...clientes]
    currentPage = 1
    atualizarTabela()
    atualizarEstatisticas()
  } catch (error) {
    console.error("Erro ao carregar clientes:", error)
    mostrarNotificacao("Erro ao carregar clientes: " + error.message, "erro")
    // Em caso de erro, garantir que clientes seja um array vazio
    clientes = []
    clientesFiltrados = []
  } finally {
    mostrarCarregando(false)
  }
}

async function carregarCorretores() {
  const usuario = obterUsuarioLogado()
  const isAdminOrHead = usuario && getCargosAsArray(usuario.cargo).some(c => c.toLowerCase().includes('admin') || c.toLowerCase().includes('head-admin'))
  
  if (!isAdminOrHead) {
    corretores = []
    return
  }

  try {
    const usuarios = await obterUsuarios()
    if (usuarios && Array.isArray(usuarios)) {
      corretores = usuarios.filter(u => getCargosAsArray(u.cargo).some(c => c.toLowerCase().includes('corretor')))
    } else {
      corretores = []
    }
  } catch (error) {
    console.error("Erro ao carregar corretores:", error)
    corretores = []
  }
}

function populateSelectAtribuicao() {
  const select = document.getElementById("filterAtribuicao")
  select.innerHTML = `<option value="">Todos os Corretores</option>`
  corretores.forEach(corretor => {
    const option = document.createElement("option")
    option.value = corretor.nome
    option.textContent = corretor.nome
    select.appendChild(option)
  })
}

function atualizarEstatisticas() {
  const totalClientes = clientes.length
  const clientesNovos = clientes.filter((c) => c.status === "novo").length
  const clientesPrioridade = clientes.filter((c) => c.status === "prioridade").length
  const clientesPreAtendido = clientes.filter((c) => c.status === "pré-atendido").length

  document.getElementById("totalClientes").textContent = totalClientes
  document.getElementById("clientesNovos").textContent = clientesNovos
  document.getElementById("clientesPrioridade").textContent = clientesPrioridade
  document.getElementById("clientesAguardando").textContent = clientesPreAtendido
}

function atualizarPaginacao() {
  const totalPaginas = Math.ceil(clientesFiltrados.length / itensPorPagina)
  document.getElementById("pageInfo").textContent = `Página ${currentPage} de ${totalPaginas}`
  document.getElementById("prevPage").disabled = currentPage === 1
  document.getElementById("nextPage").disabled = currentPage === totalPaginas
}

function aplicarPermissoes() {
  const usuario = obterUsuarioLogado()
  if (!usuario) return

  const btnNovoCliente = document.getElementById("btnNovoCliente")
  const podeEditar = obterPermissao(usuario, "clientes", "update")
  const podeCriar = obterPermissao(usuario, "clientes", "create")
  const podeDeletar = obterPermissao(usuario, "clientes", "delete")
  const podeVer = obterPermissao(usuario, "clientes", "read")
  const cargos = getCargosAsArray(usuario?.cargo).map(c => c.toLowerCase()) || []
  const isCorretor = cargos.includes('corretor') && !cargos.includes('admin') && !cargos.includes('head-admin')

  const filterAtribuicao = document.getElementById("filterAtribuicao")
  if (filterAtribuicao) {
    filterAtribuicao.style.display = isAdminOrHeadAdmin() ? "block" : "none"
  }

  const tagsGroup = document.getElementById("tagsGroup")
  if (tagsGroup) {
    tagsGroup.style.display = isAdminOrHeadAdmin() ? "block" : "none"
  }

  const itemsPerPageContainer = document.querySelector(".items-per-page-container")
  const itemsPerPageSelect = document.getElementById("itemsPerPageBottom")
  if (itemsPerPageContainer && itemsPerPageSelect) {
    itemsPerPageContainer.style.display = isAdminOrHeadAdmin() ? "flex" : "none"
    if (isAdminOrHeadAdmin()) {
      // Load saved preference
      const savedItemsPerPage = localStorage.getItem("clientesItemsPerPage")
      if (savedItemsPerPage && [10, 25, 50, 100].includes(parseInt(savedItemsPerPage))) {
        itensPorPagina = parseInt(savedItemsPerPage)
        itemsPerPageSelect.value = savedItemsPerPage
      }
    }
  }

  if (!podeVer && !isCorretor) {
    window.location.href = "/"
    return
  }

  if (btnNovoCliente) {
    btnNovoCliente.style.display = podeCriar ? "flex" : "none"
  }

  const bulkActions = document.getElementById("bulkActions")
  if (bulkActions) {
    bulkActions.style.display = "none"
  }
  
  if (!podeDeletar) {
    const btnExcluirSelecionados = document.getElementById("btnExcluirSelecionados")
    if (btnExcluirSelecionados) {
      btnExcluirSelecionados.style.display = "none"
    }
  }

  if (isCorretor) {
    const headerCheckbox = document.getElementById("headerCheckbox")
    if (headerCheckbox) {
      headerCheckbox.style.display = "none"
    }
    
    const headerAcoes = document.getElementById("headerAcoes")
    if (headerAcoes) {
      // headerAcoes.style.display = "none" // Permitir que corretores vejam a coluna de ações
    }
    
    const selectAll = document.getElementById("selectAll")
    if (selectAll && selectAll.parentElement) {
      selectAll.parentElement.style.display = "none"
    }
    
    const clienteCheckboxes = document.querySelectorAll(".cliente-checkbox")
    clienteCheckboxes.forEach(cb => {
      const td = cb.parentElement
      if (td) {
        td.style.display = "none"
      }
    })
  }
}

function atualizarTabela() {
  const tbody = document.getElementById("clientesTable")
  const usuarioLogado = obterUsuarioLogado()
  const podeEditar = obterPermissao(usuarioLogado, "clientes", "update")
  const podeDeletar = obterPermissao(usuarioLogado, "clientes", "delete")
  const isAdminOrHead = isAdminOrHeadAdmin()
  const cargos = getCargosAsArray(usuarioLogado?.cargo).map(c => c.toLowerCase()) || []
  const isCorretor = cargos.includes('corretor') && !cargos.includes('admin') && !cargos.includes('head-admin')
  const showLastContact = cargos.includes('head-admin') || cargos.includes('admin') || cargos.includes('corretor')
  const filterAtribuicaoValue = document.getElementById("filterAtribuicao").value
  const showAtribuido = isAdminOrHead || filterAtribuicaoValue !== ""

  const headerData = document.getElementById("headerData")
  if (headerData) {
    headerData.textContent = showLastContact ? "Último Contato" : "Data Atribuição"
  }

  const headerCadastradoPor = document.getElementById("headerCadastradoPor")
  if (headerCadastradoPor) {
    headerCadastradoPor.style.display = isAdminOrHead ? "" : "none"
  }

  const headerAtribuidoA = document.getElementById("headerAtribuidoA")
  if (headerAtribuidoA) {
    headerAtribuidoA.style.display = showAtribuido ? "" : "none"
  }

  const inicio = (currentPage - 1) * itensPorPagina
  const fim = inicio + itensPorPagina
  const clientesPagina = clientesFiltrados.slice(inicio, fim)

  let colspan = 8
  if (isCorretor) {
    colspan -= 1
  }
  if (showAtribuido) {
    colspan += 1
  }
  if (isAdminOrHead) {
    colspan += 1
  }

  if (clientesPagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center">Nenhum cliente encontrado</td></tr>`
  } else {
    tbody.innerHTML = clientesPagina
      .map(
        (cliente) => {
          const podeEditarEste = (podeEditar && !isCorretor) || (isCorretor && (cliente.usuario_id === usuarioLogado.id || cliente.atribuido_a === usuarioLogado.id))
          const podeDeletarEste = podeDeletar && !isCorretor
          const nomeClasse = cliente.status === "finalizado" ? "cliente-inativo" : ""

          return `
      <tr onclick="abrirDetalhesCliente(${cliente.id})" style="cursor: pointer;">
        ${!isCorretor ? `<td onclick="event.stopPropagation();">
          <input type="checkbox" class="checkbox-input cliente-checkbox" data-id="${cliente.id}">
        </td>` : ""}
        <td class="${nomeClasse}">${cliente.nome}</td>
        <td>${cliente.telefone}</td>
        <td>${formatarInteresse(cliente.interesse)}</td>
        <td><span class="badge ${cliente.status === 'finalizado' ? 'badge-finalizado' : 'badge-' + cliente.status}" style="${cliente.status === 'finalizado' ? 'background: rgba(255, 100, 100, 0.2); color: #ff6464; border: 1px solid rgba(255, 100, 100, 0.5);' : ''}">${formatarStatus(cliente.status)}</span></td>
        <td>${cliente.valor || "-"}</td>
        <td>${showLastContact ? formatarData(cliente.ultimo_contato) : formatarData(cliente.data_atribuicao)}</td>
        ${isAdminOrHead ? `<td>${cliente.cadastrado_por || "-"}</td>` : ""}
        ${showAtribuido ? `<td>${(cliente.atribuido_a_nome && cliente.atribuido_a_nome !== 'undefined') ? cliente.atribuido_a_nome : "-"}</td>` : ""}
        <td onclick="event.stopPropagation();">
          ${podeEditarEste ? `<button class="btn-action btn-edit" onclick="editarCliente(${cliente.id})" title="Editar">
            <i class="fas fa-edit"></i> Editar
          </button>` : ""}
          ${podeDeletarEste ? `<button class="btn-action btn-delete" onclick="excluirClienteConfirm(${cliente.id})" title="Excluir">
            <i class="fas fa-trash"></i> Excluir
          </button>` : ""}
        </td>
      </tr>
    `
        }
      )
      .join("")
  }

  atualizarPaginacao()
  atualizarCheckboxes()
  adicionarListenersCheckboxes()
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

  const btnNovoCliente = document.getElementById("btnNovoCliente")
  const modalCliente = document.getElementById("modalCliente")
  const closeModal = document.getElementById("closeModal")
  const formCliente = document.getElementById("formCliente")

  if (btnNovoCliente) {
    btnNovoCliente.addEventListener("click", () => {
      clienteEmEdicao = null
      document.getElementById("modalTitle").textContent = "Novo Cliente"
      formCliente.reset()
      
      // Reabilitar todos os campos e mostrar form-groups
      const camposRestritos = ["clienteNome", "clienteTelefone", "clienteEmail", "clienteValor", "clienteObservacoes", "clientePrimeiroContato", "clienteUltimoContato"]
      camposRestritos.forEach(campoId => {
        const el = document.getElementById(campoId)
        if (el) {
          el.disabled = false
          el.style.backgroundColor = ""
          el.style.cursor = ""

          const formGroup = el.closest('.form-group')
          if (formGroup) {
            formGroup.style.display = ""
          }
        }
      })
      
      // Esconder info de edição se existir
      const infoCliente = document.getElementById("infoClienteEdicao")
      if (infoCliente) {
        infoCliente.style.display = "none"
      }

      modalCliente.style.display = "flex"
    })
  }

  if (closeModal) {
    closeModal.addEventListener("click", () => {
      modalCliente.style.display = "none"
    })
  }

  const modalCloseBtns = document.querySelectorAll(".modal-close-btn")
  modalCloseBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modalCliente.style.display = "none"
    })
  })

  if (formCliente) {
    formCliente.addEventListener("submit", (e) => {
      e.preventDefault()
      salvarCliente()
    })
  }

  const searchClientes = document.getElementById("searchClientes")
  const filterStatus = document.getElementById("filterStatus")
  const filterInteresse = document.getElementById("filterInteresse")
  const filterAtribuicao = document.getElementById("filterAtribuicao")
  const btnOrdenar = document.getElementById("btnOrdenar")

  if (searchClientes) {
    searchClientes.addEventListener("input", filtrarClientes)
  }
  if (filterStatus) {
    filterStatus.addEventListener("change", filtrarClientes)
  }
  if (filterInteresse) {
    filterInteresse.addEventListener("change", filtrarClientes)
  }
  if (filterAtribuicao) {
    filterAtribuicao.addEventListener("change", filtrarClientes)
  }
  if (btnOrdenar) {
    btnOrdenar.addEventListener("click", () => {
      currentSortIndex = (currentSortIndex + 1) % sortOptions.length
      const option = sortOptions[currentSortIndex]
      btnOrdenar.innerHTML = `<i class="fas fa-sort"></i> Ordenar por: ${option.label}`
      window.currentSortValue = option.value
      currentPage = 1
      filtrarClientes()
    })
  }

  const itemsPerPage = document.getElementById("itemsPerPageBottom")
  if (itemsPerPage) {
    itemsPerPage.addEventListener("change", (e) => {
      itensPorPagina = parseInt(e.target.value)
      currentPage = 1
      localStorage.setItem("clientesItemsPerPage", itensPorPagina.toString())
      atualizarTabela()
    })
  }

  const prevPage = document.getElementById("prevPage")
  const nextPage = document.getElementById("nextPage")

  if (prevPage) {
    prevPage.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--
        atualizarTabela()
      }
    })
  }

  if (nextPage) {
    nextPage.addEventListener("click", () => {
      const totalPaginas = Math.ceil(clientesFiltrados.length / itensPorPagina)
      if (currentPage < totalPaginas) {
        currentPage++
        atualizarTabela()
      }
    })
  }

  const selectAll = document.getElementById("selectAll")
  if (selectAll) {
    selectAll.addEventListener("change", (e) => {
      // Marcar apenas os checkboxes VISÍVEIS (não ocultos por filtros)
      const visibleCheckboxes = document.querySelectorAll('.cliente-checkbox:not([style*="display: none"]):not([style*="display:none"])')
      visibleCheckboxes.forEach((checkbox) => {
        checkbox.checked = e.target.checked
      })
      atualizarCheckboxes()
    })
  }

  const btnAtribuirSelecionados = document.getElementById("btnAtribuirSelecionados")
  if (btnAtribuirSelecionados) {
    btnAtribuirSelecionados.addEventListener("click", abrirModalAtribuirSelecionados)
  }

  const btnEditarSelecionados = document.getElementById("btnEditarSelecionados")
  if (btnEditarSelecionados) {
    btnEditarSelecionados.addEventListener("click", abrirModalEditarSelecionados)
  }

  const btnExcluirSelecionados = document.getElementById("btnExcluirSelecionados")
  if (btnExcluirSelecionados) {
    btnExcluirSelecionados.addEventListener("click", excluirSelecionados)
  }

  const closeDetailsModal = document.getElementById("closeDetailsModal")
  if (closeDetailsModal) {
    closeDetailsModal.addEventListener("click", () => {
      document.getElementById("modalDetalhesCliente").style.display = "none"
    })
  }

  const btnEditarDetalhes = document.getElementById("btnEditarDetalhes")
  if (btnEditarDetalhes) {
    btnEditarDetalhes.addEventListener("click", () => {
      document.getElementById("modalDetalhesCliente").style.display = "none"
      editarCliente(clienteParaVer.id)
    })
  }

  const btnFecharDetalhes = document.getElementById("btnFecharDetalhes")
  if (btnFecharDetalhes) {
    btnFecharDetalhes.addEventListener("click", () => {
      document.getElementById("modalDetalhesCliente").style.display = "none"
    })
  }

  const closeHistoricoModal = document.getElementById("closeHistoricoModal")
  if (closeHistoricoModal) {
    closeHistoricoModal.addEventListener("click", () => {
      document.getElementById("modalHistoricoAtribuicoes").style.display = "none"
    })
  }

  const btnFecharHistorico = document.getElementById("btnFecharHistorico")
  if (btnFecharHistorico) {
    btnFecharHistorico.addEventListener("click", () => {
      document.getElementById("modalHistoricoAtribuicoes").style.display = "none"
    })
  }

  const closeHistoricoStatusModal = document.getElementById("closeHistoricoStatusModal")
  if (closeHistoricoStatusModal) {
    closeHistoricoStatusModal.addEventListener("click", () => {
      document.getElementById("modalHistoricoStatus").style.display = "none"
    })
  }

  const btnFecharHistoricoStatus = document.getElementById("btnFecharHistoricoStatus")
  if (btnFecharHistoricoStatus) {
    btnFecharHistoricoStatus.addEventListener("click", () => {
      document.getElementById("modalHistoricoStatus").style.display = "none"
    })
  }

  const btnWhatsApp = document.getElementById("btnWhatsApp")
  if (btnWhatsApp) {
    btnWhatsApp.addEventListener("click", () => {
      if (clienteParaVer && clienteParaVer.telefone) {
        let telefone = clienteParaVer.telefone.replace(/[^\d\s]/g, '').replace(/\s+/g, '')
        let whatsappNumber = '55' + telefone
        window.open(`https://wa.me/${whatsappNumber}`, '_blank')
      }
    })
  }

  const btnGerarWaMe = document.getElementById("btnGerarWaMe")
  if (btnGerarWaMe) {
    btnGerarWaMe.addEventListener("click", async () => {
      if (clienteParaVer && clienteParaVer.telefone) {
        let telefone = clienteParaVer.telefone.replace(/[^\d\s]/g, '').replace(/\s+/g, '')
        let whatsappNumber = '55' + telefone
        const waMeLink = `https://wa.me/${whatsappNumber}`

        try {
          await navigator.clipboard.writeText(waMeLink)
          mostrarNotificacao("Link wa.me copiado para a área de transferência!", "sucesso")
        } catch (error) {
          console.error("Erro ao copiar link:", error)
          // Fallback para navegadores que não suportam clipboard API
          const textArea = document.createElement("textarea")
          textArea.value = waMeLink
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
          mostrarNotificacao("Link wa.me copiado para a área de transferência!", "sucesso")
        }
      }
    })
  }

  const closeConfirmacao = document.getElementById("closeConfirmacao")
  if (closeConfirmacao) {
    closeConfirmacao.addEventListener("click", () => {
      document.getElementById("modalConfirmacao").style.display = "none"
    })
  }

  const btnCancelarExclusao = document.getElementById("btnCancelarExclusao")
  if (btnCancelarExclusao) {
    btnCancelarExclusao.addEventListener("click", () => {
      document.getElementById("modalConfirmacao").style.display = "none"
    })
  }

  // Modal de confirmação para marcar cliente como inativo
  const closeConfirmacaoInativo = document.getElementById("closeConfirmacaoInativo")
  if (closeConfirmacaoInativo) {
    closeConfirmacaoInativo.addEventListener("click", () => {
      document.getElementById("modalConfirmacaoInativo").style.display = "none"
    })
  }

  const btnCancelarInativo = document.getElementById("btnCancelarInativo")
  if (btnCancelarInativo) {
    btnCancelarInativo.addEventListener("click", () => {
      document.getElementById("modalConfirmacaoInativo").style.display = "none"
    })
  }

  const btnConfirmarInativo = document.getElementById("btnConfirmarInativo")
  if (btnConfirmarInativo) {
    btnConfirmarInativo.addEventListener("click", async () => {
      document.getElementById("modalConfirmacaoInativo").style.display = "none"
      if (window.pendingClienteSave) {
        await executarSalvamentoCliente(window.pendingClienteSave)
        window.pendingClienteSave = null
      }
    })
  }

  // Modal bulk edit event listeners
  const closeEditarSelecionados = document.getElementById("closeEditarSelecionados")
  if (closeEditarSelecionados) {
    closeEditarSelecionados.addEventListener("click", () => {
      document.getElementById("modalEditarSelecionados").style.display = "none"
    })
  }

  const btnCancelarBulkEdit = document.getElementById("btnCancelarBulkEdit")
  if (btnCancelarBulkEdit) {
    btnCancelarBulkEdit.addEventListener("click", () => {
      document.getElementById("modalEditarSelecionados").style.display = "none"
    })
  }

  const formEditarSelecionados = document.getElementById("formEditarSelecionados")
  if (formEditarSelecionados) {
    formEditarSelecionados.addEventListener("submit", (e) => {
      e.preventDefault()
      salvarEdicaoEmMassa()
    })
  }

  // Modal bulk assign event listeners
  const closeAtribuirSelecionados = document.getElementById("closeAtribuirSelecionados")
  if (closeAtribuirSelecionados) {
    closeAtribuirSelecionados.addEventListener("click", () => {
      document.getElementById("modalAtribuirSelecionados").style.display = "none"
    })
  }

  const btnCancelarBulkAssign = document.getElementById("btnCancelarBulkAssign")
  if (btnCancelarBulkAssign) {
    btnCancelarBulkAssign.addEventListener("click", () => {
      document.getElementById("modalAtribuirSelecionados").style.display = "none"
    })
  }

  const formAtribuirSelecionados = document.getElementById("formAtribuirSelecionados")
  if (formAtribuirSelecionados) {
    formAtribuirSelecionados.addEventListener("submit", (e) => {
      e.preventDefault()
      salvarAtribuicaoEmMassa()
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

function filtrarClientes() {
  const search = document.getElementById("searchClientes").value.toLowerCase()
  const filterStatus = document.getElementById("filterStatus").value
  const filterInteresse = document.getElementById("filterInteresse").value
  const filterAtribuicao = document.getElementById("filterAtribuicao").value

  // Update filtered list for pagination
  clientesFiltrados = clientes.filter((cliente) => {
    const matchSearch =
      cliente.nome.toLowerCase().includes(search) ||
      cliente.telefone.includes(search) ||
      (cliente.email && cliente.email.toLowerCase().includes(search))
    const matchStatus = !filterStatus || cliente.status === filterStatus
    const matchInteresse = !filterInteresse || cliente.interesse === filterInteresse
    const matchAtribuicao = !filterAtribuicao || ((cliente.atribuido_a_nome && cliente.atribuido_a_nome !== 'undefined' && cliente.atribuido_a_nome === filterAtribuicao) || cliente.cadastrado_por === filterAtribuicao)

    return matchSearch && matchStatus && matchInteresse && matchAtribuicao
  })

  // Apply sorting
  const sortBy = window.currentSortValue || ""
  if (sortBy) {
    clientesFiltrados.sort((a, b) => {
      if (sortBy === "nome") {
        return a.nome.localeCompare(b.nome)
      } else if (sortBy === "data_atribuicao") {
        const dateA = new Date(a.data_atribuicao || '1970-01-01')
        const dateB = new Date(b.data_atribuicao || '1970-01-01')
        return dateB - dateA // descending, newest first
      } else if (sortBy === "atualizado_em") {
        const dateA = new Date(a.atualizado_em || a.criado_em || '1970-01-01')
        const dateB = new Date(b.atualizado_em || b.criado_em || '1970-01-01')
        return dateB - dateA // descending, newest first
      }
      return 0
    })
  }

  // Check if current page is still valid after filtering
  const totalPaginas = Math.ceil(clientesFiltrados.length / itensPorPagina)
  if (currentPage > totalPaginas && totalPaginas > 0) {
    currentPage = totalPaginas
  } else if (clientesFiltrados.length === 0) {
    currentPage = 1
  }

  atualizarTabela()
}

async function salvarCliente(force = false) {
  const nome = document.getElementById("clienteNome").value.trim()
  const telefone = document.getElementById("clienteTelefone").value.trim()
  const email = document.getElementById("clienteEmail").value.trim()
  const interesse = document.getElementById("clienteInteresse").value
  const valor = document.getElementById("clienteValor").value.trim()
  const status = document.getElementById("clienteStatus").value
  const tags = document.getElementById("clienteTags") ? document.getElementById("clienteTags").value.trim() : null
  const primeiro_contato = document.getElementById("clientePrimeiroContato").value.trim()
  const ultimo_contato = document.getElementById("clienteUltimoContato").value.trim()
  const observacoes = document.getElementById("clienteObservacoes").value.trim()

  if (!nome || !telefone || !interesse || !status) {
    mostrarNotificacao("Preencha todos os campos obrigatórios", "aviso")
    return
  }

  // For editing, only include date fields that have actually changed
  let clienteData = {
    nome,
    telefone,
    email: email || null,
    interesse,
    valor: valor || null,
    status,
    tags: tags || null,
    observacoes: observacoes || null,
    data: new Date().toISOString().split("T")[0],
    force: force
  }

  // Always include date fields for both creation and editing to preserve existing values
  clienteData.primeiro_contato = primeiro_contato || null
  clienteData.ultimo_contato = ultimo_contato || null

  // Verificar se está finalizando um cliente e mostrar confirmação
  if (clienteEmEdicao && status === "finalizado") {
    const clienteExistente = clientes.find(c => c.id === clienteEmEdicao)
    if (clienteExistente && clienteExistente.status !== "finalizado") {
      // Mostrar modal de confirmação para finalizar atendimento
      document.getElementById("nomeClienteInativo").textContent = nome
      document.getElementById("modalConfirmacaoInativo").style.display = "flex"

      // Armazenar dados do cliente para salvar após confirmação
      window.pendingClienteSave = clienteData
      return
    }
  }

  await executarSalvamentoCliente(clienteData)
}

async function executarSalvamentoCliente(cliente) {
  try {
    mostrarCarregando(true)

    const usuario = obterUsuarioLogado()

    if (clienteEmEdicao) {
      // Para edições, as datas são sempre enviadas como estão
      // Se vazias, serão tratadas como null no servidor

      await atualizarCliente(clienteEmEdicao, cliente)
      registrarLog("EDITAR", "CLIENTES", `Cliente "${cliente.nome}" atualizado`, cliente.nome)
      mostrarNotificacao("Cliente atualizado com sucesso!", "sucesso")

        // Atualizar cliente no array local para preservar filtros
      const clienteIndex = clientes.findIndex(c => c.id === clienteEmEdicao)
      if (clienteIndex !== -1) {
        // Manter campos que não são editáveis por corretores ou que vêm da API
        const clienteExistente = clientes[clienteIndex]

        // Verificar mudanças de status relacionadas à ativação/inativação
        const deveDesatribuir = cliente.status === "finalizado" && clienteExistente.status !== "finalizado"
        const deveReativar = cliente.status !== "finalizado" && clienteExistente.status === "finalizado"

        const usuarioLogado = obterUsuarioLogado()
        const isCorretor = usuarioLogado && getCargosAsArray(usuarioLogado.cargo).some(c => c.toLowerCase().includes('corretor')) && !isAdminOrHeadAdmin()

        // Para corretores, preservar campos que eles não podem editar
        let clienteAtualizado
        if (isCorretor) {
          clienteAtualizado = {
            ...clienteExistente,
            // Apenas atualizar campos que corretores podem editar
            interesse: cliente.interesse !== undefined ? cliente.interesse : clienteExistente.interesse,
            valor: cliente.valor !== undefined && cliente.valor !== null && cliente.valor !== "" ? cliente.valor : clienteExistente.valor,
            observacoes: cliente.observacoes !== undefined ? cliente.observacoes : clienteExistente.observacoes,
            status: cliente.status !== undefined ? cliente.status : clienteExistente.status,
            // Campos de contato que podem ser atualizados apenas se foram enviados
            ...(cliente.primeiro_contato !== undefined && { primeiro_contato: cliente.primeiro_contato }),
            ...(cliente.ultimo_contato !== undefined && { ultimo_contato: cliente.ultimo_contato }),
            // Garantir que campos do sistema sejam preservados
            usuario_id: clienteExistente.usuario_id,
            criado_em: clienteExistente.criado_em,
            atualizado_em: new Date().toISOString(),
            cadastrado_por: clienteExistente.cadastrado_por,
            nome: clienteExistente.nome, // Preservar nome
            telefone: clienteExistente.telefone, // Preservar telefone
            email: clienteExistente.email, // Preservar email
            tags: clienteExistente.tags, // Preservar tags
            // Se foi finalizado, remover atribuição; se foi reativado, atribuir ao corretor logado apenas se for corretor
            atribuido_a: deveDesatribuir ? null : (deveReativar && isCorretor ? usuarioLogado.id : clienteExistente.atribuido_a),
            atribuido_a_nome: deveDesatribuir ? null : (deveReativar && isCorretor ? usuarioLogado.nome : clienteExistente.atribuido_a_nome),
            data_atribuicao: deveDesatribuir ? null : (deveReativar && isCorretor ? new Date().toISOString().split("T")[0] : clienteExistente.data_atribuicao)
          }
        } else {
          // Para admins, permitir atualização completa
          clienteAtualizado = {
            ...clienteExistente,
            ...cliente,
            // Garantir que campos do sistema sejam preservados
            usuario_id: clienteExistente.usuario_id,
            criado_em: clienteExistente.criado_em,
            atualizado_em: new Date().toISOString(),
            cadastrado_por: clienteExistente.cadastrado_por,
            // Se foi finalizado, remover atribuição; se foi reativado, atribuir ao corretor logado apenas se for corretor
            atribuido_a: deveDesatribuir ? null : (deveReativar && isCorretor ? usuarioLogado.id : clienteExistente.atribuido_a),
            atribuido_a_nome: deveDesatribuir ? null : (deveReativar && isCorretor ? usuarioLogado.nome : clienteExistente.atribuido_a_nome),
            data_atribuicao: deveDesatribuir ? null : (deveReativar && isCorretor ? new Date().toISOString().split("T")[0] : clienteExistente.data_atribuicao)
          }
        }

        clientes[clienteIndex] = clienteAtualizado

        // Reaplicar filtros atuais sem recarregar dados
        filtrarClientes()
      }
    } else {
      const resultado = await criarCliente(cliente)

      // Verificar se há duplicatas detectadas
      if (resultado && resultado.error === "Cliente duplicado") {
        mostrarModalDuplicatas(resultado.duplicatas, cliente, resultado.allowForce)
        return
      }

      registrarLog("CRIAR", "CLIENTES", `Novo cliente "${cliente.nome}" criado`, cliente.nome)
      mostrarNotificacao("Cliente criado com sucesso!", "sucesso")

      // Para criação de cliente, ainda precisamos recarregar para obter o ID correto
      await carregarClientes()
    }

    document.getElementById("modalCliente").style.display = "none"
  } catch (error) {
    mostrarNotificacao("Erro ao salvar cliente: " + error.message, "erro")
  } finally {
    mostrarCarregando(false)
  }
}

function editarCliente(id) {
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) return

  const usuarioLogado = obterUsuarioLogado()
  const cargos = getCargosAsArray(usuarioLogado?.cargo).map(c => c.toLowerCase()) || []
  const isCorretor = cargos.includes('corretor') && !cargos.includes('admin') && !cargos.includes('head-admin')

  if (isCorretor && parseInt(cliente.usuario_id) !== parseInt(usuarioLogado.id) && (cliente.atribuido_a === null || cliente.atribuido_a === undefined || parseInt(cliente.atribuido_a) !== parseInt(usuarioLogado.id))) {
    mostrarNotificacao("Você não tem permissão para editar este cliente", "erro")
    return
  }

  clienteEmEdicao = id
  // Store original client data for comparison
  clienteOriginalData = {
    primeiro_contato: cliente.primeiro_contato || null,
    ultimo_contato: cliente.ultimo_contato || null
  }

  document.getElementById("modalTitle").textContent = "Editar Cliente"

  // Mostrar modal primeiro
  document.getElementById("modalCliente").style.display = "flex"

  // Aguardar um ciclo de renderização para garantir que o modal esteja totalmente visível
  requestAnimationFrame(() => {
    // Resetar formulário para limpar valores anteriores
    document.getElementById("formCliente").reset()

    // Preencher campos do formulário
    document.getElementById("clienteNome").value = cliente.nome
    document.getElementById("clienteTelefone").value = cliente.telefone
    document.getElementById("clienteEmail").value = cliente.email || ""

    // Definir valores dos selects com verificação adicional
    const interesseSelect = document.getElementById("clienteInteresse")
    if (interesseSelect) {
      // Preferir preservar o valor existente; se inexistente, manter em branco
      const interesseValue = (cliente.interesse !== undefined && cliente.interesse !== null) ? cliente.interesse : ""
      interesseSelect.value = interesseValue
      // Disparar evento change manualmente para garantir que o valor seja aplicado
      interesseSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }

    const statusSelect = document.getElementById("clienteStatus")
    if (statusSelect) {
      // Garantir que o valor seja válido
      const statusValue = cliente.status || "novo"
      statusSelect.value = statusValue
      console.log("Definindo status:", statusValue, "cliente.status:", cliente.status)
      // Disparar evento change manualmente para garantir que o valor seja aplicado
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }

    document.getElementById("clienteValor").value = cliente.valor || ""
    if (document.getElementById("clienteTags")) {
      document.getElementById("clienteTags").value = cliente.tags || ""
    }
    document.getElementById("clientePrimeiroContato").value = cliente.primeiro_contato || ""
    document.getElementById("clienteUltimoContato").value = cliente.ultimo_contato || ""
    document.getElementById("clienteObservacoes").value = cliente.observacoes || ""
  })

  // Para corretores: ocultar apenas alguns campos, permitir edição de valor, observações e datas de contato
  if (isCorretor) {
    const camposParaOcultar = ["clienteNome", "clienteTelefone", "clienteEmail"]
    camposParaOcultar.forEach(campoId => {
      const el = document.getElementById(campoId)
      if (el) {
        const formGroup = el.closest('.form-group')
        if (formGroup) {
          formGroup.style.display = "none"
        }
        el.disabled = true
      }
    })

    // Mostrar e habilitar campos que corretores podem editar
    const camposParaMostrar = ["clienteValor", "clienteObservacoes", "clientePrimeiroContato", "clienteUltimoContato"]
    camposParaMostrar.forEach(campoId => {
      const el = document.getElementById(campoId)
      if (el) {
        const formGroup = el.closest('.form-group')
        if (formGroup) {
          formGroup.style.display = ""
        }
        el.disabled = false
        el.style.backgroundColor = ""
        el.style.cursor = ""
      }
    })
  } else {
    // Para admins: mostrar todos os campos
    const todosCampos = ["clienteNome", "clienteTelefone", "clienteEmail", "clienteValor", "clienteObservacoes", "clientePrimeiroContato", "clienteUltimoContato"]
    todosCampos.forEach(campoId => {
      const el = document.getElementById(campoId)
      if (el) {
        const formGroup = el.closest('.form-group')
        if (formGroup) {
          formGroup.style.display = ""
        }
        el.disabled = false
      }
    })
  }
  
  // Se for corretor, mostrar nome do cliente em destaque já que o campo de nome está oculto
  const modalBody = document.querySelector("#modalCliente .modal-body")
  let infoCliente = document.getElementById("infoClienteEdicao")
  
  if (isCorretor) {
    if (!infoCliente) {
      infoCliente = document.createElement("div")
      infoCliente.id = "infoClienteEdicao"
      infoCliente.className = "alert alert-info"
      infoCliente.style.marginBottom = "15px"
      infoCliente.style.padding = "10px"
      infoCliente.style.backgroundColor = "#0e0e0eff"
      infoCliente.style.borderRadius = "4px"
      infoCliente.style.borderLeft = "4px solid #ffd700"
      
      const form = document.getElementById("formCliente")
      form.insertBefore(infoCliente, form.firstChild)
    }
    infoCliente.innerHTML = `<strong>Editando cliente:</strong> ${cliente.nome}`
    infoCliente.style.display = "block"
  } else {
    if (infoCliente) {
      infoCliente.style.display = "none"
    }
  }

  document.getElementById("modalCliente").style.display = "flex"
}

function abrirDetalhesCliente(id) {
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) return

  clienteParaVer = cliente
  document.getElementById("detailAvatar").textContent = cliente.nome.charAt(0).toUpperCase()
  document.getElementById("detailNomeHeader").textContent = cliente.nome
  document.getElementById("detailStatusHeader").textContent = formatarStatus(cliente.status)
  document.getElementById("detailStatusHeader").className = `badge badge-${cliente.status}`
  document.getElementById("detailTelefone").textContent = cliente.telefone
  document.getElementById("detailEmail").textContent = cliente.email || "-"
  document.getElementById("detailInteresse").textContent = formatarInteresse(cliente.interesse)
  document.getElementById("detailValor").textContent = cliente.valor ? `R$ ${cliente.valor}` : "-"
  // Para todos os usuários, mostrar "Data de Atribuição"
  const usuarioLogado = obterUsuarioLogado()
  const isCorretor = usuarioLogado && getCargosAsArray(usuarioLogado.cargo).some(c => c.toLowerCase().includes('corretor'))

  const detailDataContainer = document.getElementById("detailData").parentElement
  const detailDataLabel = detailDataContainer.querySelector('.detail-label')

  // Mudar o label para "Data de Atribuição" para todos
  detailDataLabel.textContent = "Data de Atribuição"

  document.getElementById("detailData").textContent = formatarData(cliente.data_atribuicao)
  document.getElementById("detailStatus").textContent = formatarStatus(cliente.status)
  document.getElementById("detailObservacoes").textContent = cliente.observacoes || "-"
  
  const detailTagsContainer = document.getElementById("detailTagsContainer")
  const detailTags = document.getElementById("detailTags")
  if (detailTagsContainer && detailTags) {
    if (cliente.tags) {
      detailTagsContainer.style.display = "flex"
      detailTags.innerHTML = cliente.tags.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== "")
        .map(tag => `<span class="tag-badge">${tag}</span>`)
        .join("")
    } else {
      detailTagsContainer.style.display = "none"
      detailTags.innerHTML = ""
    }
  }
  
  const podeEditar = obterPermissao(usuarioLogado, "clientes", "update")
  
  const btnEditarDetalhes = document.getElementById("btnEditarDetalhes")
  if (btnEditarDetalhes) {
    const podeEditarEste = (podeEditar && !isCorretor) || (isCorretor && (cliente.usuario_id === usuarioLogado.id || cliente.atribuido_a === usuarioLogado.id))
    btnEditarDetalhes.style.display = podeEditarEste ? "" : "none"
  }

  const btnGerarWaMe = document.getElementById("btnGerarWaMe")
  if (btnGerarWaMe) {
    btnGerarWaMe.style.display = isAdminOrHeadAdmin() ? "" : "none"
  }
  
  const detailCadastradoPorContainer = document.getElementById("detailCadastradoPorContainer")
  if (detailCadastradoPorContainer) {
    if (isAdminOrHeadAdmin()) {
      detailCadastradoPorContainer.style.display = ""
      document.getElementById("detailCadastradoPor").textContent = cliente.cadastrado_por || "-"
    } else {
      detailCadastradoPorContainer.style.display = "none"
    }
  }

  const detailAtribuidoAContainer = document.getElementById("detailAtribuidoAContainer")
  if (detailAtribuidoAContainer) {
    if (isAdminOrHeadAdmin()) {
      detailAtribuidoAContainer.style.display = ""
      const detailAtribuidoA = document.getElementById("detailAtribuidoA")
      detailAtribuidoA.textContent = (cliente.atribuido_a_nome && cliente.atribuido_a_nome !== 'undefined') ? cliente.atribuido_a_nome : "-"

      // Remove clickable styles from "atribuído a"
      detailAtribuidoA.style.cursor = "default"
      detailAtribuidoA.style.textDecoration = "none"
      detailAtribuidoA.style.color = ""
      detailAtribuidoA.onclick = null
    } else {
      detailAtribuidoAContainer.style.display = "none"
    }
  }

  const detailPrimeiroContatoContainer = document.getElementById("detailPrimeiroContatoContainer")
  const detailPrimeiroContatoInput = document.getElementById("detailPrimeiroContato")
  const detailPrimeiroContatoValue = document.getElementById("detailPrimeiroContatoValue")

  if (detailPrimeiroContatoContainer && detailPrimeiroContatoInput && detailPrimeiroContatoValue) {
    if (usuarioLogado) {
      detailPrimeiroContatoContainer.style.display = ""
      detailPrimeiroContatoValue.textContent = cliente.primeiro_contato ? formatarData(cliente.primeiro_contato) : "-"
      detailPrimeiroContatoValue.style.display = ""
      detailPrimeiroContatoInput.style.display = "none"
      detailPrimeiroContatoInput.value = cliente.primeiro_contato || ""

      // Make the value clickable to edit
      detailPrimeiroContatoValue.style.cursor = "pointer"
      detailPrimeiroContatoValue.onclick = () => {
        detailPrimeiroContatoValue.style.display = "none"
        detailPrimeiroContatoInput.style.display = ""
        detailPrimeiroContatoInput.focus()
      }

      // Function to save primeiro contato
      const savePrimeiroContato = async () => {
        const newValue = detailPrimeiroContatoInput.value
        const currentValue = cliente.primeiro_contato || ""

        if (newValue !== currentValue) {
          try {
            await atualizarCliente(cliente.id, {
              primeiro_contato: newValue || null,
              ultimo_contato: cliente.ultimo_contato, // preservar o outro campo
              observacoes: cliente.observacoes // preservar as observações
            })
            cliente.primeiro_contato = newValue || null
            detailPrimeiroContatoValue.textContent = newValue ? formatarData(newValue) : "-"
            mostrarNotificacao("Primeiro contato atualizado com sucesso!", "sucesso")

            // Update in local array
            const clienteIndex = clientes.findIndex(c => c.id === cliente.id)
            if (clienteIndex !== -1) {
              clientes[clienteIndex].primeiro_contato = newValue || null
            }

            // Update table without page reload
            atualizarTabela()

            // Garantir que ambos os containers estejam sempre visíveis
            const detailUltimoContatoContainer = document.getElementById("detailUltimoContatoContainer")
            if (detailUltimoContatoContainer) {
              detailUltimoContatoContainer.style.display = ""
            }
          } catch (error) {
            mostrarNotificacao("Erro ao atualizar primeiro contato: " + error.message, "erro")
            detailPrimeiroContatoInput.value = currentValue
          }
        }

        detailPrimeiroContatoInput.style.display = "none"
        detailPrimeiroContatoValue.style.display = ""
      }

      // Handle input changes (for calendar selection and manual input)
      detailPrimeiroContatoInput.onchange = savePrimeiroContato
      detailPrimeiroContatoInput.oninput = savePrimeiroContato

      // Handle blur
      detailPrimeiroContatoInput.onblur = savePrimeiroContato

      // Handle Enter key
      detailPrimeiroContatoInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          detailPrimeiroContatoInput.blur()
        }
      }
    }
  }

  const detailUltimoContatoContainer = document.getElementById("detailUltimoContatoContainer")
  const detailUltimoContatoInput = document.getElementById("detailUltimoContato")
  const detailUltimoContatoValue = document.getElementById("detailUltimoContatoValue")

  if (detailUltimoContatoContainer && detailUltimoContatoInput && detailUltimoContatoValue) {
    if (usuarioLogado) {
      detailUltimoContatoContainer.style.display = ""
      detailUltimoContatoValue.textContent = cliente.ultimo_contato ? formatarData(cliente.ultimo_contato) : "-"
      detailUltimoContatoValue.style.display = ""
      detailUltimoContatoInput.style.display = "none"
      detailUltimoContatoInput.value = cliente.ultimo_contato || ""

      // Make the value clickable to edit
      detailUltimoContatoValue.style.cursor = "pointer"
      detailUltimoContatoValue.onclick = () => {
        detailUltimoContatoValue.style.display = "none"
        detailUltimoContatoInput.style.display = ""
        detailUltimoContatoInput.focus()
      }

      // Function to save ultimo contato
      const saveUltimoContato = async () => {
        const newValue = detailUltimoContatoInput.value
        const currentValue = cliente.ultimo_contato || ""

        if (newValue !== currentValue) {
          try {
            await atualizarCliente(cliente.id, {
              ultimo_contato: newValue || null,
              primeiro_contato: cliente.primeiro_contato, // preservar o outro campo
              observacoes: cliente.observacoes // preservar as observações
            })
            cliente.ultimo_contato = newValue || null
            detailUltimoContatoValue.textContent = newValue ? formatarData(newValue) : "-"
            mostrarNotificacao("Último contato atualizado com sucesso!", "sucesso")

            // Update in local array
            const clienteIndex = clientes.findIndex(c => c.id === cliente.id)
            if (clienteIndex !== -1) {
              clientes[clienteIndex].ultimo_contato = newValue || null
            }

            // Update table without page reload
            atualizarTabela()

            // Garantir que ambos os containers estejam sempre visíveis
            const detailPrimeiroContatoContainer = document.getElementById("detailPrimeiroContatoContainer")
            const detailPrimeiroContatoValue = document.getElementById("detailPrimeiroContatoValue")
            if (detailPrimeiroContatoContainer) {
              detailPrimeiroContatoContainer.style.display = ""
            }
            if (detailPrimeiroContatoValue) {
              detailPrimeiroContatoValue.textContent = cliente.primeiro_contato ? formatarData(cliente.primeiro_contato) : "-"
            }
          } catch (error) {
            mostrarNotificacao("Erro ao atualizar último contato: " + error.message, "erro")
            detailUltimoContatoInput.value = currentValue
          }
        }

        detailUltimoContatoInput.style.display = "none"
        detailUltimoContatoValue.style.display = ""
      }

      // Handle input changes (for calendar selection and manual input)
      detailUltimoContatoInput.onchange = saveUltimoContato
      detailUltimoContatoInput.oninput = saveUltimoContato

      // Handle blur
      detailUltimoContatoInput.onblur = saveUltimoContato

      // Handle Enter key
      detailUltimoContatoInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          detailUltimoContatoInput.blur()
        }
      }
    }
  }

  // Make the entire date detail item clickable for assignment history
  const detailDataElement = document.getElementById("detailData")
  const detailItem = detailDataElement?.closest('.detail-item')
  if (detailItem && isAdminOrHeadAdmin()) {
    detailItem.style.cursor = "pointer"
    detailItem.onclick = () => abrirHistoricoAtribuicoes(cliente.id)
  }

  // Make the status detail item clickable for status history
  const detailStatusElement = document.getElementById("detailStatus")
  const statusDetailItem = detailStatusElement?.closest('.detail-item')
  if (statusDetailItem && isAdminOrHeadAdmin()) {
    statusDetailItem.style.cursor = "pointer"
    statusDetailItem.onclick = () => abrirHistoricoStatus(cliente.id)
  }

  document.getElementById("modalDetalhesCliente").style.display = "flex"
}

async function excluirClienteConfirm(id) {
  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) return

  const usuarioLogado = obterUsuarioLogado()
  const cargos = getCargosAsArray(usuarioLogado?.cargo).map(c => c.toLowerCase()) || []
  const isCorretor = cargos.includes('corretor') && !cargos.includes('admin') && !cargos.includes('head-admin')
  
  if (isCorretor && cliente.usuario_id !== usuarioLogado.id) {
    mostrarNotificacao("Você não tem permissão para deletar este cliente", "erro")
    return
  }

  document.getElementById("nomeClienteExcluir").textContent = cliente.nome
  document.getElementById("btnConfirmarExclusao").onclick = () => excluirCliente(id)
  document.getElementById("modalConfirmacao").style.display = "flex"
}

async function excluirCliente(id) {
  const btnConfirmar = document.getElementById("btnConfirmarExclusao")
  try {
    const cliente = clientes.find((c) => c.id === id)
    if (btnConfirmar) {
      btnConfirmar.disabled = true
    }
    await deletarCliente(id)
    registrarLog("DELETAR", "CLIENTES", `Cliente "${cliente?.nome}" deletado`, cliente?.nome)
    mostrarNotificacao("Cliente deletado com sucesso!", "sucesso")
    document.getElementById("modalConfirmacao").style.display = "none"
    await carregarClientes()
  } catch (error) {
    mostrarNotificacao("Erro ao deletar cliente: " + error.message, "erro")
  } finally {
    if (btnConfirmar) {
      btnConfirmar.disabled = false
    }
  }
}

function atualizarCheckboxes() {
  const checkboxes = document.querySelectorAll(".cliente-checkbox")
  clientesSelecionados = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => parseInt(cb.getAttribute("data-id")))

  const bulkActions = document.getElementById("bulkActions")
  if (clientesSelecionados.length > 0) {
    bulkActions.style.display = "flex"
    document.getElementById("selectedCount").textContent = `${clientesSelecionados.length} cliente(s) selecionado(s)`
  } else {
    bulkActions.style.display = "none"
  }
}

function adicionarListenersCheckboxes() {
  const checkboxes = document.querySelectorAll(".cliente-checkbox")
  checkboxes.forEach((checkbox) => {
    checkbox.removeEventListener("change", atualizarCheckboxes)
    checkbox.addEventListener("change", atualizarCheckboxes)
  })
}

async function excluirSelecionados() {
  if (clientesSelecionados.length === 0) {
    mostrarNotificacao("Nenhum cliente selecionado", "aviso")
    return
  }

  const nomes = clientesSelecionados
    .map(id => clientes.find(c => c.id === id)?.nome)
    .filter(Boolean)
    .join(", ")

  document.getElementById("nomeClienteExcluir").textContent = `${clientesSelecionados.length} cliente(s): ${nomes}`
  document.getElementById("btnConfirmarExclusao").onclick = () => executarExclusaoEmMassa()
  document.getElementById("modalConfirmacao").style.display = "flex"
}

async function executarExclusaoEmMassa() {
  const btnConfirmar = document.getElementById("btnConfirmarExclusao")
  try {
    if (btnConfirmar) {
      btnConfirmar.disabled = true
    }
    for (const id of clientesSelecionados) {
      const cliente = clientes.find((c) => c.id === id)
      await deletarCliente(id)
      registrarLog("DELETAR", "CLIENTES", `Cliente "${cliente?.nome}" deletado (em massa)`, cliente?.nome)
    }
    document.getElementById("modalConfirmacao").style.display = "none"
    mostrarNotificacao("Clientes deletados com sucesso!", "sucesso")
    await carregarClientes()
  } catch (error) {
    mostrarNotificacao("Erro ao deletar clientes: " + error.message, "erro")
  } finally {
    if (btnConfirmar) {
      btnConfirmar.disabled = false
    }
  }
}

function abrirModalEditarSelecionados() {
  if (clientesSelecionados.length === 0) {
    mostrarNotificacao("Nenhum cliente selecionado", "aviso")
    return
  }

  // Verificar permissões
  const usuarioLogado = obterUsuarioLogado()
  const podeEditar = obterPermissao(usuarioLogado, "clientes", "update")
  const cargos = getCargosAsArray(usuarioLogado?.cargo).map(c => c.toLowerCase()) || []
  const isCorretor = cargos.includes('corretor') && !cargos.includes('admin') && !cargos.includes('head-admin')

  if (!podeEditar && !isCorretor) {
    mostrarNotificacao("Você não tem permissão para editar clientes", "erro")
    return
  }

  // Para corretores, verificar se todos os clientes selecionados são deles
  if (isCorretor) {
    const clientesNaoAutorizados = clientesSelecionados.filter(id => {
      const cliente = clientes.find(c => c.id === id)
      return cliente && cliente.usuario_id !== usuarioLogado.id && cliente.atribuido_a !== usuarioLogado.id
    })

    if (clientesNaoAutorizados.length > 0) {
      mostrarNotificacao("Você só pode editar clientes que criou ou que estão atribuídos a você", "erro")
      return
    }
  }

  // Preencher informações do modal
  document.getElementById("bulkEditCount").textContent = clientesSelecionados.length

  // Mostrar lista de clientes selecionados
  const listaContainer = document.getElementById("bulkEditClientesList")
  if (listaContainer) {
    const clientesSelecionadosInfo = clientesSelecionados.map(id => {
      const cliente = clientes.find(c => c.id === id)
      return cliente ? `<div class="bulk-client-item">${cliente.nome}</div>` : ""
    }).filter(Boolean)

    listaContainer.innerHTML = clientesSelecionadosInfo.join("")
  }

  // Resetar formulário
  const form = document.getElementById("formEditarSelecionados")
  if (form) {
    form.reset()
  }

  // Mostrar modal
  document.getElementById("modalEditarSelecionados").style.display = "flex"
}

async function salvarEdicaoEmMassa() {
  const novoStatus = document.getElementById("bulkEditStatus").value

  if (!novoStatus) {
    mostrarNotificacao("Selecione um status", "aviso")
    return
  }

  const btnSalvar = document.getElementById("btnSalvarBulkEdit")
  try {
    if (btnSalvar) {
      btnSalvar.disabled = true
      btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'
    }

    mostrarCarregando(true)

    // Atualizar cada cliente selecionado
    const atualizacoes = []
    for (const id of clientesSelecionados) {
      const cliente = clientes.find((c) => c.id === id)
      if (cliente) {
        const clienteAtualizado = {
          ...cliente,
          status: novoStatus
        }

        try {
          await atualizarCliente(id, clienteAtualizado)
          registrarLog("EDITAR", "CLIENTES", `Status do cliente "${cliente.nome}" alterado para "${formatarStatus(novoStatus)}" (em massa)`, cliente.nome)

          // Atualizar no array local
          const clienteIndex = clientes.findIndex(c => c.id === id)
          if (clienteIndex !== -1) {
            const deveDesatribuir = novoStatus === "finalizado" && clientes[clienteIndex].status !== "finalizado"
            const deveReativar = novoStatus !== "finalizado" && clientes[clienteIndex].status === "finalizado"
            const usuarioLogado = obterUsuarioLogado()
            const isCorretor = usuarioLogado && getCargosAsArray(usuarioLogado.cargo).some(c => c.toLowerCase().includes('corretor')) && !isAdminOrHeadAdmin()
            clientes[clienteIndex] = {
              ...clientes[clienteIndex],
              status: novoStatus,
              atualizado_em: new Date().toISOString(),
              // Se foi finalizado, remover atribuição; se foi reativado, atribuir ao corretor logado apenas se for corretor
              atribuido_a: deveDesatribuir ? null : (deveReativar && isCorretor ? usuarioLogado.id : clientes[clienteIndex].atribuido_a),
              atribuido_a_nome: deveDesatribuir ? null : (deveReativar && isCorretor ? usuarioLogado.nome : clientes[clienteIndex].atribuido_a_nome),
              data_atribuicao: deveDesatribuir ? null : (deveReativar && isCorretor ? new Date().toISOString().split("T")[0] : clientes[clienteIndex].data_atribuicao)
            }
          }

          atualizacoes.push(cliente.nome)
        } catch (error) {
          console.error(`Erro ao atualizar cliente ${cliente.nome}:`, error)
        }
      }
    }

    document.getElementById("modalEditarSelecionados").style.display = "none"

    if (atualizacoes.length > 0) {
      mostrarNotificacao(`${atualizacoes.length} cliente(s) atualizado(s) com sucesso!`, "sucesso")
    } else {
      mostrarNotificacao("Nenhum cliente foi atualizado", "aviso")
    }

    // Limpar seleções
    clientesSelecionados = []
    document.querySelectorAll(".cliente-checkbox").forEach(cb => cb.checked = false)
    document.getElementById("selectAll").checked = false
    atualizarCheckboxes()

    // Atualizar tabela e estatísticas
    filtrarClientes()
    atualizarEstatisticas()

  } catch (error) {
    mostrarNotificacao("Erro ao atualizar clientes: " + error.message, "erro")
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false
      btnSalvar.innerHTML = '<i class="fas fa-save"></i> Aplicar Alterações'
    }
    mostrarCarregando(false)
  }
}

function abrirModalAtribuirSelecionados() {
  if (clientesSelecionados.length === 0) {
    mostrarNotificacao("Nenhum cliente selecionado", "aviso")
    return
  }

  // Verificar permissões - apenas admins podem atribuir clientes
  if (!isAdminOrHeadAdmin()) {
    mostrarNotificacao("Você não tem permissão para atribuir clientes a corretores", "erro")
    return
  }

  // Preencher informações do modal
  document.getElementById("bulkAssignCount").textContent = clientesSelecionados.length

  // Mostrar lista de clientes selecionados
  const listaContainer = document.getElementById("bulkAssignClientesList")
  if (listaContainer) {
    const clientesSelecionadosInfo = clientesSelecionados.map(id => {
      const cliente = clientes.find(c => c.id === id)
      return cliente ? `<div class="bulk-client-item">${cliente.nome}</div>` : ""
    }).filter(Boolean)

    listaContainer.innerHTML = clientesSelecionadosInfo.join("")
  }

  // Popular select de corretores
  const selectCorretor = document.getElementById("bulkAssignCorretor")
  if (selectCorretor) {
    selectCorretor.innerHTML = `<option value="">Selecione um corretor</option>`
    corretores.forEach(corretor => {
      const option = document.createElement("option")
      option.value = corretor.id
      option.textContent = corretor.nome
      selectCorretor.appendChild(option)
    })
  }

  // Resetar formulário
  const form = document.getElementById("formAtribuirSelecionados")
  if (form) {
    form.reset()
  }

  // Mostrar modal
  document.getElementById("modalAtribuirSelecionados").style.display = "flex"
}

async function salvarAtribuicaoEmMassa() {
  const corretorId = document.getElementById("bulkAssignCorretor").value

  if (!corretorId) {
    mostrarNotificacao("Selecione um corretor", "aviso")
    return
  }

  const corretor = corretores.find(c => c.id == corretorId)
  if (!corretor) {
    mostrarNotificacao("Corretor não encontrado", "erro")
    return
  }

  const btnSalvar = document.getElementById("btnSalvarBulkAssign")
  try {
    if (btnSalvar) {
      btnSalvar.disabled = true
      btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atribuindo...'
    }

    mostrarCarregando(true)

    // Atribuir cada cliente selecionado
    const atribuicoes = []
    const erros = []

    for (const id of clientesSelecionados) {
      const cliente = clientes.find((c) => c.id === id)
      if (cliente) {
        try {
          console.log(`Tentando atribuir cliente ${cliente.nome} (ID: ${id}) ao corretor ${corretor.nome} (ID: ${corretorId})`)
          const resultado = await atribuirCliente(id, corretorId)
          console.log(`Atribuição bem-sucedida para cliente ${cliente.nome}:`, resultado)

          registrarLog("ATRIBUIR_CLIENTE", "CLIENTES", `Cliente "${cliente.nome}" atribuído ao corretor "${corretor.nome}"`, cliente.nome)

          // Atualizar no array local
          const clienteIndex = clientes.findIndex(c => c.id === id)
          if (clienteIndex !== -1) {
            clientes[clienteIndex] = {
              ...clientes[clienteIndex],
              atribuido_a: corretorId,
              atribuido_a_nome: corretor.nome,
              data_atribuicao: new Date().toISOString(),
              atualizado_em: new Date().toISOString()
            }
          }

          atribuicoes.push(cliente.nome)
        } catch (error) {
          console.error(`Erro ao atribuir cliente ${cliente.nome}:`, error)
          erros.push(`${cliente.nome}: ${error.message}`)
        }
      }
    }

    document.getElementById("modalAtribuirSelecionados").style.display = "none"

    // Mostrar resultado baseado no sucesso
    if (atribuicoes.length > 0) {
      let mensagem = `${atribuicoes.length} cliente(s) atribuído(s) com sucesso ao corretor ${corretor.nome}!`
      if (erros.length > 0) {
        mensagem += ` (${erros.length} falha(s))`
      }
      mostrarNotificacao(mensagem, atribuicoes.length === clientesSelecionados.length ? "sucesso" : "aviso")

      if (erros.length > 0) {
        console.warn("Erros de atribuição:", erros)
        setTimeout(() => {
          mostrarNotificacao(`Falhas: ${erros.join("; ")}`, "erro")
        }, 3000)
      }
    } else {
      mostrarNotificacao(`Falha na atribuição: ${erros.join("; ")}`, "erro")
    }

    // Limpar seleções apenas se houve pelo menos uma atribuição bem-sucedida
    if (atribuicoes.length > 0) {
      clientesSelecionados = clientesSelecionados.filter(id => {
        const cliente = clientes.find(c => c.id === id)
        return cliente && !atribuicoes.includes(cliente.nome)
      })

      if (clientesSelecionados.length === 0) {
        document.querySelectorAll(".cliente-checkbox").forEach(cb => cb.checked = false)
        document.getElementById("selectAll").checked = false
      }

      atualizarCheckboxes()
      // Recarregar clientes para atualizar a lista imediatamente
      await carregarClientes()
    }

  } catch (error) {
    console.error("Erro geral na atribuição em massa:", error)
    mostrarNotificacao("Erro ao atribuir clientes: " + error.message, "erro")
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false
      btnSalvar.innerHTML = '<i class="fas fa-user-plus"></i> Atribuir Corretor'
    }
    mostrarCarregando(false)
  }
}

function mostrarCarregando(show) {
  const modal = document.getElementById("modalCliente")
  const btn = modal?.querySelector(".btn-primary")
  if (btn) {
    btn.disabled = show
  }
}

function formatarData(data) {
  if (!data) return "-"
  try {
    const d = new Date(data + 'T12:00:00')
    if (isNaN(d.getTime())) return "-" // Verifica se a data é válida
    return d.toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo' })
  } catch (error) {
    return "-"
  }
}

function formatarStatus(status) {
  if (!status || status === "n/a" || status === "N/A") return "Novo"
  const map = {
    novo: "Novo",
    "em-atendimento": "Em Atendimento",
    prioridade: "Prioridade",
    "pré-atendido": "Pré-Atendido",
    finalizado: "Inativo"
  }
  return map[status] || status
}

function formatarInteresse(interesse) {
  if (!interesse) return "Alugar"
  const map = {
    alugar: "Alugar",
    comprar: "Comprar",
    vender: "Vender"
  }
  return map[interesse] || interesse
}

async function abrirHistoricoAtribuicoes(clienteId) {
  try {
    mostrarCarregando(true)
    const historico = await obterHistoricoAtribuicoes(clienteId)
    console.log("Histórico recebido:", historico)

    document.getElementById("historicoClienteNome").textContent = historico.cliente_nome

    const container = document.getElementById("historicoAtribuicoesContainer")

    // Data de cadastro primeiro
    let html = ""
    if (historico.data_cadastro) {
      html += `
        <div class="historico-item data-cadastro">
          <div class="historico-icon">
            <i class="fas fa-calendar-plus"></i>
          </div>
          <div class="historico-content">
            <div class="historico-title">Cliente Cadastrado</div>
            <div class="historico-description">
              Cliente foi cadastrado no sistema
            </div>
            <div class="historico-date">${historico.data_cadastro}</div>
          </div>
        </div>
      `
    }

    // Primeira atribuição
    if (historico.primeira_atribuicao) {
      html += `
        <div class="historico-item primeira-atribuicao">
          <div class="historico-icon">
            <i class="fas fa-user-plus"></i>
          </div>
          <div class="historico-content">
            <div class="historico-title">Primeira Atribuição</div>
            <div class="historico-description">
              Atribuído a <strong>${historico.primeira_atribuicao.corretor_nome}</strong>
            </div>
            <div class="historico-date">${formatarDataHora(historico.primeira_atribuicao.data)}</div>
          </div>
        </div>
      `
    }

    // Outras atribuições
    historico.atribuicoes.forEach(atribuicao => {
      const isAtribuicao = atribuicao.acao === "ATRIBUIR_CLIENTE"
      const iconClass = isAtribuicao ? "fas fa-arrow-right" : "fas fa-times"
      const title = isAtribuicao ? "Atribuído" : "Removido"
      const bgClass = isAtribuicao ? "atribuicao" : "remocao"

      html += `
        <div class="historico-item ${bgClass}">
          <div class="historico-icon">
            <i class="${iconClass}"></i>
          </div>
          <div class="historico-content">
            <div class="historico-title">${title}</div>
            <div class="historico-description">${atribuicao.descricao}</div>
            <div class="historico-user">Por: ${atribuicao.usuario_logado}</div>
            <div class="historico-date">${formatarDataHora(atribuicao.data)}</div>
          </div>
        </div>
      `
    })

    if (!historico.data_cadastro && !historico.primeira_atribuicao && historico.atribuicoes.length === 0) {
      html = `<div class="historico-empty">Nenhuma atribuição encontrada para este cliente.</div>`
    }

    container.innerHTML = html

    document.getElementById("modalHistoricoAtribuicoes").style.display = "flex"
  } catch (error) {
    console.error("Erro ao carregar histórico de atribuições:", error)
    mostrarNotificacao("Erro ao carregar histórico: " + error.message, "erro")
  } finally {
    mostrarCarregando(false)
  }
}

async function abrirHistoricoStatus(clienteId) {
  try {
    mostrarCarregando(true)
    const historico = await obterHistoricoStatus(clienteId)
    console.log("Histórico de status recebido:", historico)

    document.getElementById("historicoStatusClienteNome").textContent = historico.cliente_nome

    const container = document.getElementById("historicoStatusContainer")

    // Mostrar status atual fixo no topo
    let html = `
      <div class="historico-item status-atual">
        <div class="historico-icon">
          <i class="fas fa-info-circle"></i>
        </div>
        <div class="historico-content">
          <div class="historico-title">Status Atual</div>
          <div class="historico-description">
            <span class="badge badge-${historico.status_atual}">${formatarStatus(historico.status_atual)}</span>
          </div>
        </div>
      </div>
    `

    // Primeiro, adicionar entrada de criação do cliente se não houver histórico
    if (!historico.historico_status || historico.historico_status.length === 0) {
      html += `
        <div class="historico-item data-cadastro">
          <div class="historico-icon">
            <i class="fas fa-calendar-plus"></i>
          </div>
          <div class="historico-content">
            <div class="historico-title">Cliente Cadastrado</div>
            <div class="historico-description">
              Status inicial: <span class="badge badge-${historico.status_atual}">${formatarStatus(historico.status_atual)}</span>
            </div>
            <div class="historico-date">${formatarDataHora(historico.cliente_criado_em || new Date().toISOString())}</div>
          </div>
        </div>
      `
    }

    // Adicionar todas as mudanças históricas de status
    if (historico.historico_status && historico.historico_status.length > 0) {
      // Adicionar entrada de criação primeiro
      const primeiraMudanca = historico.historico_status[historico.historico_status.length - 1]
      if (primeiraMudanca && primeiraMudanca.descricao && primeiraMudanca.descricao.includes('de "N/A" para')) {
        // Extrair o status inicial da primeira mudança
        const match = primeiraMudanca.descricao.match(/de "([^"]+)" para "([^"]+)"/)
        if (match) {
          const statusInicial = match[1] === 'N/A' ? 'novo' : match[1].toLowerCase().replace(/\s+/g, '-')
          html += `
            <div class="historico-item data-cadastro">
              <div class="historico-icon">
                <i class="fas fa-calendar-plus"></i>
              </div>
              <div class="historico-content">
                <div class="historico-title">Cliente Cadastrado</div>
                <div class="historico-description">
                  Status inicial: <span class="badge badge-${statusInicial}">${formatarStatus(statusInicial)}</span>
                </div>
                <div class="historico-date">${formatarDataHora(historico.cliente_criado_em || primeiraMudanca.data)}</div>
              </div>
            </div>
          `
        }
      }

      // Adicionar todas as mudanças de status em ordem cronológica
      historico.historico_status.slice().reverse().forEach(statusItem => {
        const statusClass = statusItem.status ? `badge badge-${statusItem.status}` : 'badge'
        const statusText = formatarStatus(statusItem.status)

        html += `
          <div class="historico-item status-change">
            <div class="historico-icon">
              <i class="fas fa-exchange-alt"></i>
            </div>
            <div class="historico-content">
              <div class="historico-title">Status Alterado</div>
              <div class="historico-description">
                ${statusItem.descricao || `Status definido como <span class="${statusClass}">${statusText}</span>`}
              </div>
              <div class="historico-user">Por: ${statusItem.usuario || 'Sistema'}</div>
              <div class="historico-date">${statusItem.data}</div>
            </div>
          </div>
        `
      })
    }

    // Se não há histórico mas temos status atual, mostrar como status atual
    if (html === "" && historico.status_atual) {
      const statusClass = `badge badge-${historico.status_atual}`
      const statusText = formatarStatus(historico.status_atual)

      html += `
        <div class="historico-item data-cadastro">
          <div class="historico-icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <div class="historico-content">
            <div class="historico-title">Status Atual</div>
            <div class="historico-description">
              Status atual: <span class="${statusClass}">${statusText}</span>
            </div>
            <div class="historico-date">${formatarDataHora(new Date().toISOString())}</div>
          </div>
        </div>
      `
    }

    if (!historico.status_atual && (!historico.historico_status || historico.historico_status.length === 0)) {
      html = `<div class="historico-empty">Nenhuma mudança de status encontrada para este cliente.</div>`
    }

    container.innerHTML = html

    document.getElementById("modalHistoricoStatus").style.display = "flex"
  } catch (error) {
    console.error("Erro ao carregar histórico de status:", error)
    mostrarNotificacao("Erro ao carregar histórico de status: " + error.message, "erro")
  } finally {
    mostrarCarregando(false)
  }
}

function formatarDataHora(dataString) {
  // O servidor já retorna as datas formatadas no timezone correto
  return dataString || "-"
}

// Função para mostrar modal de duplicatas
function mostrarModalDuplicatas(duplicatas, cliente, allowForce = false) {
  // Criar modal de duplicatas se não existir
  let modalDuplicatas = document.getElementById("modalDuplicatas")
  if (!modalDuplicatas) {
    modalDuplicatas = document.createElement("div")
    modalDuplicatas.id = "modalDuplicatas"
    modalDuplicatas.className = "modal modal-duplicatas"
    modalDuplicatas.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Cliente Duplicado</h3>
          <span class="modal-close-btn" id="closeModalDuplicatas">&times;</span>
        </div>
        <div class="modal-body">
          <div class="alert alert-danger" id="alertMensagem">
            Já existe um cliente cadastrado com este número de telefone. Não é permitido cadastrar clientes duplicados.
          </div>

          <div class="cliente-info">
            <h4>Cliente que tentou cadastrar:</h4>
            <div class="cliente-card novo-cliente">
              <div class="cliente-header">
                <strong>${cliente.nome}</strong>
                <span class="badge badge-${cliente.status || 'novo'}">${formatarStatus(cliente.status || 'novo')}</span>
              </div>
              <div class="cliente-details">
                <span><i class="fas fa-phone"></i> ${cliente.telefone}</span>
                ${cliente.email ? `<span><i class="fas fa-envelope"></i> ${cliente.email}</span>` : ''}
                <span><i class="fas fa-tag"></i> ${formatarInteresse(cliente.interesse)}</span>
                ${cliente.valor ? `<span><i class="fas fa-dollar-sign"></i> R$ ${cliente.valor}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="duplicatas-list">
            <h4>Cliente(s) já cadastrado(s) com este telefone:</h4>
            <div id="duplicatasContainer"></div>
          </div>

          <div class="modal-actions" id="modalActions">
            <button type="button" class="btn btn-secondary" id="btnFecharDuplicata">
              <i class="fas fa-times"></i> Fechar
            </button>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(modalDuplicatas)

    // Event listeners
    document.getElementById("closeModalDuplicatas").addEventListener("click", () => {
      modalDuplicatas.style.display = "none"
    })

    document.getElementById("btnFecharDuplicata").addEventListener("click", () => {
      modalDuplicatas.style.display = "none"
    })
  } else {
    // Atualizar conteúdo dinâmico se o modal já existe
    const header = modalDuplicatas.querySelector('.modal-header h3')
    header.innerHTML = `Cliente Duplicado`

    const alert = modalDuplicatas.querySelector('#alertMensagem')
    alert.innerHTML = `Já existe um cliente cadastrado com este número de telefone. Não é permitido cadastrar clientes duplicados.`

    const clienteCard = modalDuplicatas.querySelector('.cliente-card.novo-cliente')
    clienteCard.innerHTML = `
      <div class="cliente-header">
        <strong>${cliente.nome}</strong>
        <span class="badge badge-${cliente.status || 'novo'}">${formatarStatus(cliente.status || 'novo')}</span>
      </div>
      <div class="cliente-details">
        <span><i class="fas fa-phone"></i> ${cliente.telefone}</span>
        ${cliente.email ? `<span><i class="fas fa-envelope"></i> ${cliente.email}</span>` : ''}
        <span><i class="fas fa-tag"></i> ${formatarInteresse(cliente.interesse)}</span>
        ${cliente.valor ? `<span><i class="fas fa-dollar-sign"></i> R$ ${cliente.valor}</span>` : ''}
      </div>
    `
  }

  // Preencher lista de duplicatas
  const container = document.getElementById("duplicatasContainer")
  container.innerHTML = duplicatas.map((duplicata, index) => `
    <div class="cliente-card duplicata">
      <div class="cliente-header">
        <strong>${duplicata.nome}</strong>
        <span class="badge badge-${duplicata.status}">${formatarStatus(duplicata.status)}</span>
      </div>
      <div class="cliente-details">
        <span><i class="fas fa-phone"></i> ${duplicata.telefone}</span>
        ${duplicata.email ? `<span><i class="fas fa-envelope"></i> ${duplicata.email}</span>` : ''}
        <span><i class="fas fa-tag"></i> ${formatarInteresse(duplicata.interesse)}</span>
        ${duplicata.valor ? `<span><i class="fas fa-dollar-sign"></i> R$ ${duplicata.valor}</span>` : ''}
        ${duplicata.cadastrado_por ? `<span><i class="fas fa-user"></i> Por: ${duplicata.cadastrado_por}</span>` : ''}
        ${(duplicata.atribuido_a_nome && duplicata.atribuido_a_nome !== 'undefined') ? `<span><i class="fas fa-user-tag"></i> Atribuído a: ${duplicata.atribuido_a_nome}</span>` : ''}
      </div>
    </div>
  `).join("")

  // Mostrar modal
  modalDuplicatas.style.display = "flex"
}
