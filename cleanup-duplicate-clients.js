#!/usr/bin/env node

/**
 * Script para limpar clientes com nomes duplicados
 * Detecta clientes com mesmo nome e oferece opções para resolvê-los
 * 
 * Uso: node cleanup-duplicate-clients.js
 */

const db = require("./src/config/db")
const readline = require("readline")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer)
    })
  })
}

async function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const query = db.query || db.run || db.all

    if (db.isPostgres) {
      // PostgreSQL
      db.query(sql, params, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    } else {
      // SQLite
      if (sql.trim().toUpperCase().startsWith("SELECT")) {
        db.all(sql, params, (err, result) => {
          if (err) reject(err)
          else resolve({ rows: result })
        })
      } else {
        db.run(sql, params, function (err) {
          if (err) reject(err)
          else resolve({ changes: this.changes })
        })
      }
    }
  })
}

async function main() {
  try {
    console.log("\n🔍 Procurando clientes com nomes duplicados...\n")

    // Encontrar clientes com nomes duplicados
    const query = `
      SELECT nome, COUNT(*) as quantidade, GROUP_CONCAT(id) as ids
      FROM clientes
      GROUP BY LOWER(nome)
      HAVING COUNT(*) > 1
      ORDER BY quantidade DESC
    `

    const duplicates = await dbQuery(query)
    const rows = duplicates.rows || duplicates

    if (rows.length === 0) {
      console.log("✅ Nenhum cliente com nome duplicado encontrado!")
      rl.close()
      process.exit(0)
    }

    console.log(`⚠️  Encontrados ${rows.length} grupo(s) de clientes com nomes duplicados:\n`)

    for (const grupo of rows) {
      console.log(`📋 Nome: "${grupo.nome}"`)
      console.log(`   Quantidade: ${grupo.quantidade} registros`)

      const ids = grupo.ids.split(",").map(id => parseInt(id.trim()))

      // Buscar detalhes de cada cliente
      const clientesQuery = `
        SELECT id, nome, telefone, email, status, data_atribuicao, atribuido_a_nome, criado_em
        FROM clientes
        WHERE id IN (${ids.join(",")})
        ORDER BY criado_em DESC
      `

      const clientes = await dbQuery(clientesQuery)
      const clientesRows = clientes.rows || clientes

      clientesRows.forEach((cliente, idx) => {
        console.log(`   [${idx + 1}] ID: ${cliente.id}`)
        console.log(`       Telefone: ${cliente.telefone}`)
        console.log(`       Email: ${cliente.email || "N/A"}`)
        console.log(`       Status: ${cliente.status}`)
        console.log(`       Atribuído a: ${cliente.atribuido_a_nome || "N/A"}`)
        console.log(`       Criado em: ${cliente.criado_em}`)
      })

      console.log("")
    }

    // Perguntar se deseja fazer limpeza
    const resposta = await question("\n🤔 Deseja fazer limpeza de duplicatas? (s/n): ")

    if (resposta.toLowerCase() !== "s") {
      console.log("\n✅ Operação cancelada.")
      rl.close()
      process.exit(0)
    }

    // Lógica de limpeza: manter o cliente mais recente e fusionar os dados dos antigos
    let totalMescladosOuDeletados = 0

    for (const grupo of rows) {
      const ids = grupo.ids.split(",").map(id => parseInt(id.trim()))

      const clientesQuery = `
        SELECT id, nome, telefone, email, status, data_atribuicao, atribuido_a, atribuido_a_nome, criado_em, ultimo_contato, primeiro_contato
        FROM clientes
        WHERE id IN (${ids.join(",")})
        ORDER BY criado_em ASC
      `

      const clientes = await dbQuery(clientesQuery)
      const clientesRows = clientes.rows || clientes

      if (clientesRows.length <= 1) continue

      // O cliente a manter será o mais antigo (primeiro criado)
      const clientePrincipal = clientesRows[0]
      const clientesDuplicados = clientesRows.slice(1)

      console.log(`\n📌 Processando "${grupo.nome}":`)
      console.log(`   Mantendo: ID ${clientePrincipal.id} (criado em ${clientePrincipal.criado_em})`)

      // Fusionar dados dos clientes duplicados
      for (const clienteDup of clientesDuplicados) {
        console.log(`   Merging: ID ${clienteDup.id} → ID ${clientePrincipal.id}`)

        // Atualizar qualquer coisa que referencie o cliente duplicado
        try {
          // Atualizar agendamentos
          await dbQuery("UPDATE agendamentos SET cliente_id = $1 WHERE cliente_id = $2", [
            clientePrincipal.id,
            clienteDup.id
          ])

          // Atualizar logs que referenciem o cliente
          await dbQuery("UPDATE logs_auditoria SET cliente_id = $1 WHERE cliente_id = $2", [
            clientePrincipal.id,
            clienteDup.id
          ])

          // Deletar o cliente duplicado
          await dbQuery("DELETE FROM clientes WHERE id = $1", [clienteDup.id])

          console.log(`   ✅ Cliente ID ${clienteDup.id} removido`)
          totalMescladosOuDeletados++
        } catch (error) {
          console.error(`   ❌ Erro ao processar ID ${clienteDup.id}:`, error.message)
        }
      }
    }

    console.log(`\n✅ Limpeza concluída! ${totalMescladosOuDeletados} cliente(s) duplicado(s) removido(s)`)
    console.log("\n💡 Próximos passos:")
    console.log("   1. Faça backup do banco de dados")
    console.log("   2. Reinicie o servidor")
    console.log("   3. Verifique se os clientes estão com dados corretos")

    rl.close()
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Erro durante a limpeza:", error)
    rl.close()
    process.exit(1)
  }
}

main()
