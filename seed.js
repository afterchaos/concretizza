const sqlite3 = require("sqlite3").verbose()
const bcrypt = require("bcryptjs")
const path = require("path")

const dbPath = process.env.DB_PATH || path.join(__dirname, "concretizza.db")
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao conectar banco:", err)
    process.exit(1)
  }
})

const BCRYPT_ROUNDS = 10

const usuariosPadrao = [
  {
    nome: "Head Admin",
    email: "head@concretizza.com",
    username: "head",
    password: "123456",
    permissao: "head-admin"
  },
  {
    nome: "Administrador",
    email: "admin@concretizza.com",
    username: "admin",
    password: "123456",
    permissao: "admin"
  },
  {
    nome: "Editor",
    email: "editor@concretizza.com",
    username: "editor",
    password: "123456",
    permissao: "editor"
  },
  {
    nome: "Visualizador",
    email: "viewer@concretizza.com",
    username: "viewer",
    password: "123456",
    permissao: "visualizar"
  }
]

async function seedDatabase() {
  for (const usuario of usuariosPadrao) {
    try {
      const senhaHash = await new Promise((resolve, reject) => {
        bcrypt.hash(usuario.password, BCRYPT_ROUNDS, (err, hash) => {
          if (err) reject(err)
          else resolve(hash)
        })
      })

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO usuarios (nome, email, username, senha, permissao, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [usuario.nome, usuario.email, usuario.username, senhaHash, usuario.permissao, "ativo"],
          (err) => {
            if (err) reject(err)
            else resolve()
          }
        )
      })

      console.log(`✓ Usuário ${usuario.username} criado/atualizado`)
    } catch (error) {
      console.error(`✗ Erro ao criar usuário ${usuario.username}:`, error)
    }
  }

  db.close(() => {
    console.log("✓ Seed concluído com sucesso!")
    process.exit(0)
  })
}

seedDatabase().catch((error) => {
  console.error("Erro durante seed:", error)
  process.exit(1)
})
