const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'src', 'config', 'concretizza.db'));

try {
  console.log('=== USERS ===');
  const users = db.prepare('SELECT id, nome, username, permissao FROM usuarios').all();
  users.forEach(u => console.log(`${u.id}: ${u.nome} (${u.username}) - ${u.permissao}`));

  console.log('\n=== CORRETORES ===');
  const corretores = db.prepare('SELECT id, nome, username, permissao FROM usuarios WHERE permissao LIKE "%corretor%"').all();
  corretores.forEach(u => console.log(`${u.id}: ${u.nome} (${u.username})`));

} catch (e) {
  console.log('Error:', e.message);
} finally {
  db.close();
}
