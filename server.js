require("dotenv").config()
const express = require("express")
const path = require("path")
const fs = require("fs")
const sqlite3 = require("sqlite3").verbose()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { body, validationResult, param } = require("express-validator")
const cors = require("cors")
const rateLimit = require("express-rate-limit")

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_jwt_super_secreta_aqui_min_32_caracteres"
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10

// ===== MIDDLEWARE DE SEGURANÇA =====
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))

const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: "Muitas requisições, tente novamente mais tarde",
  skip: (req) => {
    return !req.path.startsWith('/api/')
  }
})

app.use(limiter)
app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ limit: "1mb", extended: true }))

app.use((req, res, next) => {
  if (req.url.endsWith('.js') || req.url.endsWith('.css') || req.url.endsWith('.html')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
  }
  next()
})

app.use(express.static(path.join(__dirname, "src")))
app.use("/src", express.static(path.join(__dirname, "src")))

// ===== MIDDLEWARE DE AUTENTICAÇÃO JWT =====
function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]
  
  if (!token) {
    console.log("[AUTH] Token não fornecido")
    return res.status(401).json({ error: "Token não fornecido" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    console.log("[AUTH] Token verificado:", decoded)
    req.usuario = decoded
    next()
  } catch (err) {
    console.log("[AUTH] Token inválido:", err.message)
    return res.status(401).json({ error: "Token inválido ou expirado" })
  }
}

// ===== MIDDLEWARE DE AUTORIZAÇÃO =====
function autorizar(...cargos) {
  return (req, res, next) => {
    console.log(`[AUTORIZAR] Verificando cargo "${req.usuario.cargo}" contra [${cargos.join(", ")}]`)
    if (!cargos.includes(req.usuario.cargo)) {
      console.log(`[AUTORIZAR] Permissão negada para cargo "${req.usuario.cargo}"`)
      return res.status(403).json({ error: "Permissão negada" })
    }
    console.log(`[AUTORIZAR] Permissão concedida para cargo "${req.usuario.cargo}"`)
    next()
  }
}

// ===== VALIDAÇÃO DE ERROS =====
function validarRequisicao(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const mensagem = errors.array().map(e => e.msg).join("; ")
    return res.status(400).json({ error: mensagem })
  }
  next()
}

// ===== INICIALIZAR BANCO DE DADOS =====
const dbPath = process.env.DB_PATH || path.join(__dirname, "concretizza.db")
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Erro ao conectar banco:", err)
  else console.log("Banco de dados conectado")
})

// ===== CRIAR TABELAS =====
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      email TEXT,
      interesse TEXT,
      valor TEXT,
      status TEXT,
      observacoes TEXT,
      data TEXT,
      usuario_id INTEGER,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.all("PRAGMA table_info(clientes)", (err, columns) => {
    if (err) return
    const hasUsuarioId = columns.some(col => col.name === 'usuario_id')
    if (!hasUsuarioId) {
      db.run("ALTER TABLE clientes ADD COLUMN usuario_id INTEGER", (err) => {
        if (err) console.log("Coluna usuario_id já existe ou erro ao adicionar:", err.message)
        else console.log("Coluna usuario_id adicionada com sucesso")
      })
    }
  })

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      permissao TEXT DEFAULT 'visualizar',
      status TEXT DEFAULT 'ativo',
      telefone TEXT,
      departamento TEXT,
      ultimoAcesso TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      tipo TEXT,
      status TEXT DEFAULT 'agendado',
      observacoes TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS logs_auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      acao TEXT NOT NULL,
      modulo TEXT NOT NULL,
      descricao TEXT,
      ip_address TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `)
})

// ===== ROTA DE AUTENTICAÇÃO (LOGIN) =====
app.post(
  "/api/auth/login",
  [
    body("username").trim().notEmpty().withMessage("Usuário é obrigatório"),
    body("password").notEmpty().withMessage("Senha é obrigatória")
  ],
  validarRequisicao,
  (req, res) => {
    const { username, password } = req.body
    console.log(`[LOGIN] Tentativa de login para usuário: ${username}`)
    
    db.get(
      "SELECT id, nome, email, username, senha, permissao FROM usuarios WHERE (username = ? OR email = ?) AND status = ?",
      [username, username, "ativo"],
      (err, user) => {
        if (err) {
          console.log(`[LOGIN] Erro ao buscar usuário:`, err)
          return res.status(500).json({ error: "Erro no servidor" })
        }
        
        if (!user) {
          console.log(`[LOGIN] Usuário não encontrado: ${username}`)
          return res.status(401).json({ error: "Usuário ou senha incorretos" })
        }

        console.log(`[LOGIN] Usuário encontrado: ${user.username}, permissao: ${user.permissao}`)

        bcrypt.compare(password, user.senha, (err, isValid) => {
          if (err) {
            console.log(`[LOGIN] Erro ao comparar senha:`, err)
            return res.status(500).json({ error: "Erro no servidor" })
          }
          
          if (!isValid) {
            console.log(`[LOGIN] Senha inválida para ${username}`)
            return res.status(401).json({ error: "Usuário ou senha incorretos" })
          }

          console.log(`[LOGIN] Autenticação bem-sucedida para ${username}`)
          const token = jwt.sign(
            { id: user.id, username: user.username, cargo: user.permissao },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || "24h" }
          )

          console.log(`[LOGIN] Token gerado para ${username}, cargo: ${user.permissao}`)

          db.run("UPDATE usuarios SET ultimoAcesso = ? WHERE id = ?", [new Date().toISOString(), user.id])

          res.json({
            token,
            usuario: {
              id: user.id,
              nome: user.nome,
              email: user.email,
              cargo: user.permissao
            }
          })
        })
      }
    )
  }
)

// ===== ROTA DE REGISTRO (CRIAR USUÁRIO) =====
app.post(
  "/api/auth/register",
  [
    body("nome").trim().isLength({ min: 3 }).withMessage("Nome deve ter no mínimo 3 caracteres"),
    body("email").isEmail().withMessage("Email inválido"),
    body("username").trim().isLength({ min: 3 }).withMessage("Username deve ter no mínimo 3 caracteres"),
    body("password").isLength({ min: 6 }).withMessage("Senha deve ter no mínimo 6 caracteres")
  ],
  validarRequisicao,
  (req, res) => {
    const { nome, email, username, password } = req.body

    bcrypt.hash(password, BCRYPT_ROUNDS, (err, senhaHash) => {
      if (err) return res.status(500).json({ error: "Erro ao processar senha" })

      db.run(
        "INSERT INTO usuarios (nome, email, username, senha, permissao, status) VALUES (?, ?, ?, ?, ?, ?)",
        [nome, email, username, senhaHash, "editor", "ativo"],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE")) {
              return res.status(400).json({ error: "Email ou username já cadastrado" })
            }
            return res.status(500).json({ error: "Erro ao criar usuário" })
          }
          
          res.status(201).json({ id: this.lastID, message: "Usuário criado com sucesso" })
        }
      )
    })
  }
)

// ===== ROTAS DE CLIENTES =====
app.get("/api/clientes", autenticar, (req, res) => {
  db.all(
    "SELECT id, nome, telefone, email, interesse, valor, status, observacoes, data FROM clientes ORDER BY data DESC",
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Erro ao buscar clientes" })
      res.json(rows || [])
    }
  )
})

app.post(
  "/api/clientes",
  autenticar,
  autorizar("admin", "head-admin", "editor"),
  [
    body("nome").trim().notEmpty().withMessage("Nome é obrigatório"),
    body("telefone").trim().notEmpty().withMessage("Telefone é obrigatório"),
    body("email").optional({ checkFalsy: true }).trim().isEmail().withMessage("Email deve ser válido se informado"),
    body("interesse").trim().notEmpty().withMessage("Interesse é obrigatório"),
    body("status").trim().notEmpty().withMessage("Status é obrigatório")
  ],
  validarRequisicao,
  (req, res) => {
    const { nome, telefone, email, interesse, valor, status, observacoes, data } = req.body
    
    console.log("[CLIENTES] Criando novo cliente:", { nome, telefone, email, interesse, valor, status, observacoes, data })
    
    db.run(
      "INSERT INTO clientes (nome, telefone, email, interesse, valor, status, observacoes, data, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [nome, telefone, email || null, interesse, valor || null, status, observacoes || null, data, req.usuario.id],
      function (err) {
        if (err) {
          console.error("[CLIENTES] Erro ao inserir cliente:", err)
          return res.status(500).json({ error: "Erro ao criar cliente: " + err.message })
        }
        console.log("[CLIENTES] Cliente criado com sucesso, ID:", this.lastID)
        res.status(201).json({ id: this.lastID, message: "Cliente criado com sucesso" })
      }
    )
  }
)

app.put(
  "/api/clientes/:id",
  autenticar,
  autorizar("admin", "head-admin", "editor"),
  [
    param("id").isInt().withMessage("ID inválido"),
    body("nome").optional().trim().notEmpty().withMessage("Nome não pode estar vazio"),
    body("email").optional({ checkFalsy: true }).trim().isEmail().withMessage("Email deve ser válido se informado")
  ],
  validarRequisicao,
  (req, res) => {
    const { id } = req.params
    const { nome, telefone, email, interesse, valor, status, observacoes } = req.body
    
    db.run(
      "UPDATE clientes SET nome = ?, telefone = ?, email = ?, interesse = ?, valor = ?, status = ?, observacoes = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
      [nome, telefone, email, interesse, valor, status, observacoes, id],
      function (err) {
        if (err) return res.status(500).json({ error: "Erro ao atualizar cliente" })
        if (this.changes === 0) return res.status(404).json({ error: "Cliente não encontrado" })
        res.json({ success: true, message: "Cliente atualizado com sucesso" })
      }
    )
  }
)

app.delete(
  "/api/clientes/:id",
  autenticar,
  autorizar("admin", "head-admin"),
  [param("id").isInt().withMessage("ID inválido")],
  validarRequisicao,
  (req, res) => {
    const { id } = req.params
    
    db.run("DELETE FROM clientes WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: "Erro ao deletar cliente" })
      if (this.changes === 0) return res.status(404).json({ error: "Cliente não encontrado" })
      res.json({ success: true, message: "Cliente deletado com sucesso" })
    })
  }
)

// ===== ROTAS DE USUÁRIOS (APENAS PARA ADMINS) =====
app.get(
  "/api/usuarios",
  autenticar,
  autorizar("admin", "head-admin"),
  (req, res) => {
    db.all(
      "SELECT id, nome, email, username, permissao, status, telefone, departamento, ultimoAcesso FROM usuarios ORDER BY nome",
      (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar usuários" })
        res.json(rows || [])
      }
    )
  }
)

app.post(
  "/api/usuarios",
  autenticar,
  autorizar("head-admin", "admin"),
  [
    body("nome").trim().notEmpty().withMessage("Nome é obrigatório"),
    body("email").isEmail().withMessage("Email inválido"),
    body("username").trim().isLength({ min: 3 }).withMessage("Username deve ter no mínimo 3 caracteres"),
    body("password").isLength({ min: 6 }).withMessage("Senha deve ter no mínimo 6 caracteres"),
    body("permissao").trim().notEmpty().withMessage("Permissão é obrigatória")
  ],
  validarRequisicao,
  (req, res) => {
    const { nome, email, username, password, permissao, status, telefone, departamento } = req.body
    const cargoUsuarioLogado = req.usuario.cargo.toLowerCase()

    if (cargoUsuarioLogado === "admin" && (permissao.toLowerCase() === "admin" || permissao.toLowerCase() === "head-admin")) {
      return res.status(403).json({ error: "Admin não pode criar usuários com cargo admin ou superior" })
    }

    bcrypt.hash(password, BCRYPT_ROUNDS, (err, senhaHash) => {
      if (err) return res.status(500).json({ error: "Erro ao processar senha" })

      db.run(
        "INSERT INTO usuarios (nome, email, username, senha, permissao, status, telefone, departamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [nome, email, username, senhaHash, permissao, status || "ativo", telefone || null, departamento || null],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE")) {
              return res.status(400).json({ error: "Email ou username já cadastrado" })
            }
            return res.status(500).json({ error: "Erro ao criar usuário" })
          }
          res.status(201).json({ id: this.lastID, message: "Usuário criado com sucesso" })
        }
      )
    })
  }
)

app.put(
  "/api/usuarios/:id",
  autenticar,
  autorizar("head-admin", "admin"),
  [param("id").isInt().withMessage("ID inválido")],
  validarRequisicao,
  (req, res) => {
    const { id } = req.params
    const { nome, email, password, permissao, status, telefone, departamento } = req.body
    const cargoUsuarioLogado = req.usuario.cargo.toLowerCase()
    const usuarioIdSendoEditado = parseInt(id)

    db.get("SELECT permissao FROM usuarios WHERE id = ?", [usuarioIdSendoEditado], (err, usuarioAlvo) => {
      if (err) return res.status(500).json({ error: "Erro ao verificar usuário" })
      if (!usuarioAlvo) return res.status(404).json({ error: "Usuário não encontrado" })

      const cargoAlvo = usuarioAlvo.permissao.toLowerCase()

      if (cargoUsuarioLogado === "admin" && (cargoAlvo === "admin" || cargoAlvo === "head-admin")) {
        return res.status(403).json({ error: "Admin não pode editar usuários com cargo igual ou superior" })
      }

      if (password) {
        bcrypt.hash(password, BCRYPT_ROUNDS, (err, senhaHash) => {
          if (err) return res.status(500).json({ error: "Erro ao processar senha" })
          
          db.run(
            "UPDATE usuarios SET nome = ?, email = ?, senha = ?, permissao = ?, status = ?, telefone = ?, departamento = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
            [nome, email, senhaHash, permissao, status, telefone, departamento, id],
            function (err) {
              if (err) {
                console.error("[UPDATE USER] Erro ao atualizar usuário com senha:", err)
                if (err.message.includes("UNIQUE")) {
                  return res.status(400).json({ error: "Email já cadastrado" })
                }
                return res.status(500).json({ error: "Erro ao atualizar usuário: " + err.message })
              }
              if (this.changes === 0) return res.status(404).json({ error: "Usuário não encontrado" })
              res.json({ success: true, message: "Usuário atualizado com sucesso" })
            }
          )
        })
      } else {
        db.run(
          "UPDATE usuarios SET nome = ?, email = ?, permissao = ?, status = ?, telefone = ?, departamento = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
          [nome, email, permissao, status, telefone, departamento, id],
          function (err) {
            if (err) {
              console.error("[UPDATE USER] Erro ao atualizar usuário:", err)
              if (err.message.includes("UNIQUE")) {
                return res.status(400).json({ error: "Email já cadastrado" })
              }
              return res.status(500).json({ error: "Erro ao atualizar usuário: " + err.message })
            }
            if (this.changes === 0) return res.status(404).json({ error: "Usuário não encontrado" })
            res.json({ success: true, message: "Usuário atualizado com sucesso" })
          }
        )
      }
    })
  }
)

app.delete(
  "/api/usuarios/:id",
  autenticar,
  autorizar("head-admin", "admin"),
  [param("id").isInt().withMessage("ID inválido")],
  validarRequisicao,
  (req, res) => {
    const { id } = req.params
    const usuarioId = parseInt(id)
    const usuarioAtual = req.usuario

    console.log(`[DELETE USUARIO] Tentativa de deletar usuário ${usuarioId} por ${usuarioAtual.cargo} (ID: ${usuarioAtual.id})`)

    if (usuarioId === usuarioAtual.id) {
      console.log("[DELETE USUARIO] Erro: tentativa de deletar a própria conta")
      return res.status(400).json({ error: "Você não pode deletar sua própria conta" })
    }

    db.get("SELECT permissao FROM usuarios WHERE id = ?", [usuarioId], (err, usuario) => {
      if (err) {
        console.error("[DELETE USUARIO] Erro ao buscar usuário:", err)
        return res.status(500).json({ error: "Erro ao deletar usuário" })
      }

      if (!usuario) {
        console.log("[DELETE USUARIO] Usuário não encontrado")
        return res.status(404).json({ error: "Usuário não encontrado" })
      }

      const cargoUsuarioLogado = usuarioAtual.cargo?.toLowerCase()
      const cargoUsuarioAlvo = usuario.permissao?.toLowerCase()

      if (cargoUsuarioLogado === "admin" && (cargoUsuarioAlvo === "admin" || cargoUsuarioAlvo === "head-admin")) {
        console.log("[DELETE USUARIO] Erro: Admin tentou deletar usuário com cargo igual ou superior")
        return res.status(403).json({ error: "Admin não pode deletar usuários com cargo igual ou superior" })
      }

      db.run("DELETE FROM usuarios WHERE id = ?", [usuarioId], function (err) {
        if (err) {
          console.error("[DELETE USUARIO] Erro ao deletar:", err)
          return res.status(500).json({ error: "Erro ao deletar usuário" })
        }
        if (this.changes === 0) {
          console.log("[DELETE USUARIO] Usuário não encontrado no delete")
          return res.status(404).json({ error: "Usuário não encontrado" })
        }
        console.log("[DELETE USUARIO] Usuário deletado com sucesso")
        res.json({ success: true, message: "Usuário deletado com sucesso" })
      })
    })
  }
)

// ===== SERVIR ARQUIVO RAIZ =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "pages", "index.html"))
})

app.get("/pages/:page", (req, res) => {
  const { page } = req.params
  res.sendFile(path.join(__dirname, "src", "pages", `${page}.html`))
})

// ===== TRATAMENTO DE ERROS =====
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: "Erro interno do servidor" })
})

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" })
})

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log(`Servidor Concretizza rodando na porta ${PORT}`)
  console.log(`Ambiente: ${process.env.NODE_ENV || "development"}`)
})

process.on("SIGINT", () => {
  db.close()
  process.exit()
})
