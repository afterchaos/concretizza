const db = require('./src/config/db');

async function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (db.query && typeof db.query === 'function') {
      db.query(sql, params).then(resolve).catch(reject);
    } else if (db.all && typeof db.all === 'function') {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve({ rows });
      });
    } else {
      reject(new Error('Database query method not available'));
    }
  });
}

async function main() {
  console.log('\n📊 Análise detalhada de clientes...\n');
  
  try {
    // Contar clientes por ativo
    console.log('Clientes por status de "ativo":');
    const ativoCount = await dbQuery('SELECT ativo, COUNT(*) as total FROM clientes GROUP BY ativo');
    const ativoRows = ativoCount.rows || ativoCount;
    ativoRows.forEach(row => {
      console.log(`  ativo = ${row.ativo}: ${row.total} clientes`);
    });
    
    // Clientes com ativo = 0 (FALSE/Inativos)
    console.log('\n\nClientes com ativo = 0 (INATIVOS):');
    const inativos = await dbQuery('SELECT id, nome, status, ativo FROM clientes WHERE ativo = 0');
    const inativosRows = inativos.rows || inativos;
    console.log(`  Total: ${inativosRows.length}`);
    inativosRows.forEach(cliente => {
      console.log(`  ID: ${cliente.id}, Nome: ${cliente.nome}, Status: ${cliente.status || 'N/A'}, Ativo: ${cliente.ativo}`);
    });
    
    // Clientes com status NULL
    console.log('\n\nClientes com status = NULL:');
    const nullStatus = await dbQuery('SELECT id, nome, status, ativo FROM clientes WHERE status IS NULL');
    const nullStatusRows = nullStatus.rows || nullStatus;
    console.log(`  Total: ${nullStatusRows.length}`);
    nullStatusRows.forEach(cliente => {
      console.log(`  ID: ${cliente.id}, Nome: ${cliente.nome}, Ativo: ${cliente.ativo}`);
    });
    
    // Resumo
    console.log('\n\n📋 RESUMO:');
    const total = await dbQuery('SELECT COUNT(*) as total FROM clientes');
    const totalRows = total.rows || total;
    console.log(`  Total de clientes: ${totalRows[0]?.total || 0}`);
    
    const ativos = await dbQuery('SELECT COUNT(*) as total FROM clientes WHERE ativo = 1');
    const ativosRows = ativos.rows || ativos;
    console.log(`  Clientes ativos (ativo=1): ${ativosRows[0]?.total || 0}`)
    
    const inativos2 = await dbQuery('SELECT COUNT(*) as total FROM clientes WHERE ativo = 0');
    const inativos2Rows = inativos2.rows || inativos2;
    console.log(`  Clientes inativos (ativo=0): ${inativos2Rows[0]?.total || 0}`);
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.error(err);
  }
  
  process.exit(0);
}

main();
