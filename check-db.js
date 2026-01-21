const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'src', 'config', 'concretizza.db'));

try {
  console.log('=== DATABASE INSPECTION ===');

  // List all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));

  // Check corretor_links schema
  const clSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='corretor_links'").get();
  if (clSchema) {
    console.log('\n=== corretor_links SCHEMA ===');
    console.log(clSchema.sql);
  } else {
    console.log('corretor_links table does not exist');
  }

  // Check link_assignments schema
  const laSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='link_assignments'").get();
  if (laSchema) {
    console.log('\n=== link_assignments SCHEMA ===');
    console.log(laSchema.sql);
  } else {
    console.log('link_assignments table does not exist');
  }

  // Check data in corretor_links
  if (clSchema) {
    console.log('\n=== SAMPLE corretor_links DATA ===');
    const links = db.prepare('SELECT id, titulo, url, criado_por FROM corretor_links LIMIT 3').all();
    console.log('Links count:', links.length);
    links.forEach(link => console.log(`- ID ${link.id}: ${link.titulo}`));
  }

  // Check data in link_assignments
  if (laSchema) {
    console.log('\n=== SAMPLE link_assignments DATA ===');
    const assignments = db.prepare('SELECT id, link_id, corretor_id FROM link_assignments LIMIT 5').all();
    console.log('Assignments count:', assignments.length);
    assignments.forEach(assignment => console.log(`- Link ${assignment.link_id} -> Corretor ${assignment.corretor_id}`));
  }

} catch (e) {
  console.log('Error:', e.message);
} finally {
  db.close();
}
