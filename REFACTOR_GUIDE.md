# 🔄 Guia de Refatoração - Migrate de localStorage para API

## Problema
Todo o código está usando **localStorage** para armazenar clientes, usuários, etc. Mas agora temos uma **API real** no backend.

## Solução
Refatorar todos os scripts para usar as funções da **data.js** que chamam a API.

---

## Scripts que precisam refatorar:

### 1. **clientes.js** 
**Atual (localStorage):**
```javascript
function getClientes() {
  return JSON.parse(localStorage.getItem("clientes")) || []
}

function salvarClientes() {
  localStorage.setItem("clientes", JSON.stringify(clientes))
}
```

**Novo (API):**
```javascript
async function carregarClientes() {
  try {
    clientes = await obterClientes()
    clientesFiltrados = [...clientes]
    atualizarTabela()
    atualizarEstatisticas()
  } catch (error) {
    console.error("Erro ao carregar clientes:", error)
  }
}

async function salvarCliente() {
  const cliente = {
    nome: document.getElementById("clienteNome").value,
    telefone: document.getElementById("clienteTelefone").value,
    email: document.getElementById("clienteEmail").value,
    interesse: document.getElementById("clienteInteresse").value,
    valor: document.getElementById("clienteValor").value,
    status: document.getElementById("clienteStatus").value,
    observacoes: document.getElementById("clienteObservacoes").value,
    data: new Date().toISOString().split('T')[0]
  }

  try {
    if (clienteEmEdicao) {
      await atualizarCliente(clienteEmEdicao, cliente)
      alert("Cliente atualizado com sucesso!")
    } else {
      await criarCliente(cliente)
      alert("Cliente criado com sucesso!")
    }
    modalCliente.style.display = "none"
    await carregarClientes()
  } catch (error) {
    alert("Erro ao salvar cliente")
  }
}

async function excluirCliente(id) {
  if (confirm("Tem certeza que deseja deletar?")) {
    try {
      await deletarCliente(id)
      alert("Cliente deletado com sucesso!")
      await carregarClientes()
    } catch (error) {
      alert("Erro ao deletar cliente")
    }
  }
}
```

---

### 2. **dashboard.js**
**Mude de:**
```javascript
function getClientes() {
  return JSON.parse(localStorage.getItem("clientes")) || []
}
```

**Para:**
```javascript
async function carregarDados() {
  try {
    clientes = await obterClientes()
    atualizarEstatisticas()
    atualizarTabela()
  } catch (error) {
    console.error("Erro ao carregar dados:", error)
  }
}
```

---

### 3. **usuarios.js**
**Mude de:**
```javascript
function carregarUsuarios() {
  usuarios = JSON.parse(localStorage.getItem("usuarios")) || []
}

function salvarUsuarios() {
  localStorage.setItem("usuarios", JSON.stringify(usuarios))
}
```

**Para:**
```javascript
async function carregarUsuarios() {
  try {
    usuarios = await obterUsuarios()
    atualizarTabela()
  } catch (error) {
    console.error("Erro ao carregar usuários:", error)
  }
}

async function salvarUsuario() {
  const usuario = {
    nome: document.getElementById("usuarioNome").value,
    email: document.getElementById("usuarioEmail").value,
    username: document.getElementById("usuarioUsername").value,
    password: document.getElementById("usuarioPassword").value,
    permissao: document.getElementById("usuarioPermissao").value
  }

  try {
    if (usuarioEmEdicao) {
      await atualizarUsuario(usuarioEmEdicao, usuario)
    } else {
      await criarUsuario(usuario)
    }
    await carregarUsuarios()
  } catch (error) {
    alert("Erro ao salvar usuário")
  }
}
```

---

### 4. **logs.js**
**Remover localStorage e implementar com API** (backend ainda não tem endpoint de logs, mas pode usar uma tabela de auditoria)

---

## Passo a Passo para Refatorar

1. **Abra clientes.js**
2. **Procure por `localStorage.getItem`** e `localStorage.setItem`
3. **Substitua por chamadas assincronas à API** usando funções de **data.js**
4. **Remova funções síncronas** e torne-as `async`
5. **Adicione try/catch** para tratar erros
6. **Teste no navegador** (abra DevTools → Console para ver erros)

---

## Funções disponíveis em data.js (já feito):

```javascript
await obterClientes()          // GET /api/clientes
await criarCliente(cliente)    // POST /api/clientes
await atualizarCliente(id, cliente)  // PUT /api/clientes/:id
await deletarCliente(id)       // DELETE /api/clientes/:id

await obterUsuarios()          // GET /api/usuarios
await criarUsuario(usuario)    // POST /api/usuarios
await atualizarUsuario(id, usuario)  // PUT /api/usuarios/:id
await deletarUsuario(id)       // DELETE /api/usuarios/:id

fazerLogout()                  // Remove token e redireciona
```

---

## ⚠️ Importante

- Todas as requisições são **assincronas** (async/await)
- O token é enviado **automaticamente** no header
- Se token expirar, usuario é redirecionado para login
- **NÃO REMOVA** o localStorage de `token` e `usuarioLogado` - são necessários para autenticação

---

## Recomendação

Se quiser que eu refatore tudo para você, me diga qual arquivo quer começar:
1. clientes.js
2. dashboard.js
3. usuarios.js
4. todos

Deixe comigo!
