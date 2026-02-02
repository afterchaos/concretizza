#!/usr/bin/env node

/**
 * Script para validar integridade do banco de dados
 * Verifica se há clientes com IDs duplicados ou sincronização incorreta
 * 
 * Uso: node validate-database-integrity.js
 */

const db = require("./src/config/db")

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
    console.log("\n🔍 Validando integridade do banco de dados...\n")

    // 1. Verificar IDs duplicados
    console.log("1️⃣  Verificando IDs duplicados...")
    const idDuplicados = await dbQuery(`
      SELECT id, COUNT(*) as quantidade
      FROM clientes
      GROUP BY id
      HAVING COUNT(*) > 1
    `)
    const idDupRows = idDuplicados.rows || idDuplicados
    
    if (idDupRows && idDupRows.length > 0) {
      console.error("❌ ENCONTRADOS IDS DUPLICADOS:")
      idDupRows.forEach(row => {
        console.error(`   ID ${row.id}: ${row.quantidade} registros`)
      })
    } else {
      console.log("✅ Nenhum ID duplicado encontrado")
    }

    // 2. Verificar clientes com mesmo nome
    console.log("\n2️⃣  Verificando clientes com mesmo nome...")
    const nomeDuplicados = await dbQuery(`
      SELECT nome, COUNT(*) as quantidade, GROUP_CONCAT(id) as ids
      FROM clientes
      GROUP BY LOWER(nome)
      HAVING COUNT(*) > 1
      ORDER BY quantidade DESC
      LIMIT 10
    `)
    const nomeDupRows = nomeDuplicados.rows || nomeDuplicados
    
    if (nomeDupRows && nomeDupRows.length > 0) {
      console.warn("⚠️  ENCONTRADOS CLIENTES COM MESMO NOME (isso é normal, mas monitorar):")
      nomeDupRows.forEach(row => {
        console.warn(`   Nome: "${row.nome}" - ${row.quantidade} registros (IDs: ${row.ids})`)
      })
    } else {
      console.log("✅ Nenhum cliente com nome duplicado")
    }

    // 3. Verificar integridade de dados (campos NULL)
    console.log("\n3️⃣  Verificando campos NULL obrigatórios...")
    const nullFields = await dbQuery(`
      SELECT 
        SUM(CASE WHEN nome IS NULL THEN 1 ELSE 0 END) as nome_null,
        SUM(CASE WHEN telefone IS NULL THEN 1 ELSE 0 END) as telefone_null,
        SUM(CASE WHEN id IS NULL THEN 1 ELSE 0 END) as id_null
      FROM clientes
    `)
    const nullFieldsRows = nullFields.rows || nullFields
    const nullData = nullFieldsRows ? nullFieldsRows[0] : {}

    if (nullData.id_null > 0) {
      console.error(`❌ Encontrados ${nullData.id_null} clientes com ID NULL`)
    }
    if (nullData.nome_null > 0) {
      console.error(`❌ Encontrados ${nullData.nome_null} clientes com nome NULL`)
    }
    if (nullData.telefone_null > 0) {
      console.error(`❌ Encontrados ${nullData.telefone_null} clientes com telefone NULL`)
    }
    if (nullData.id_null === 0 && nullData.nome_null === 0 && nullData.telefone_null === 0) {
      console.log("✅ Nenhum campo obrigatório NULL")
    }

    // 4. Verificar total de clientes
    console.log("\n4️⃣  Estatísticas gerais...")
    const stats = await dbQuery("SELECT COUNT(*) as total FROM clientes")
    const statsRows = stats.rows || stats
    const statsData = statsRows ? statsRows[0] : { total: 0 }
    console.log(`   Total de clientes: ${statsData.total}`)

    console.log("\n✨ Validação concluída!\n")

    process.exit(0)
  } catch (error) {
    console.error("❌ Erro durante validação:", error)
    process.exit(1)
  }
}

main()
