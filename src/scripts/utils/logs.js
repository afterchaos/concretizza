function registrarLog(acao, modulo, descricao, usuarioAfetado = null) {
  const usuario = obterUsuarioLogado()
  if (!usuario) return

  const log = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    acao: acao,
    modulo: modulo,
    descricao: descricao,
    usuarioLogado: usuario.nome || usuario.username,
    usuarioLogadoId: usuario.id,
    usuarioAfetado: usuarioAfetado,
    dataFormatada: new Date().toLocaleDateString('pt-BR'),
    horaFormatada: new Date().toLocaleTimeString('pt-BR'),
  }

  const logs = JSON.parse(localStorage.getItem('logs')) || []
  logs.push(log)
  localStorage.setItem('logs', JSON.stringify(logs))

  console.log('[LOG]', acao, modulo, descricao)
}

function obterLogs() {
  return JSON.parse(localStorage.getItem('logs')) || []
}

function limparLogs() {
  localStorage.setItem('logs', JSON.stringify([]))
}

function exportarLogs() {
  const logs = obterLogs()
  const csv = [
    ['ID', 'Data', 'Hora', 'Ação', 'Módulo', 'Descrição', 'Usuário', 'Usuário Afetado'].join(','),
    ...logs.map(l => [
      l.id,
      l.dataFormatada,
      l.horaFormatada,
      l.acao,
      l.modulo,
      `"${l.descricao}"`,
      l.usuarioLogado,
      l.usuarioAfetado || '-'
    ].join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `logs_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}
