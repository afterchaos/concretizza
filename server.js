// server.js
const express = require('express');
const path = require('path');

const app = express();
// O Render fornecerá a porta via process.env.PORT; usamos a 3000 como fallback local.
const PORT = process.env.PORT || 3000;

// =======================================================
// === CONFIGURAÇÃO DOS CAMINHOS ESTÁTICOS PARA O EXPRESS ===
// =======================================================

// Define a pasta base 'src' para simplificar a construção dos caminhos
const SRC_DIR = path.join(__dirname, 'src');

// Define os caminhos absolutos para os três diretórios principais de ativos
const PAGES_DIR = path.join(SRC_DIR, 'pages');
const STYLES_DIR = path.join(SRC_DIR, 'styles');
const SCRIPTS_DIR = path.join(SRC_DIR, 'scripts'); 

// =======================================================
// === SERVINDO ARQUIVOS ESTÁTICOS (Frontend Assets) ===
// =======================================================

// A ordem é importante. Servir 'scripts' e 'styles' primeiro garante que eles sejam encontrados 
// facilmente mesmo que o nome do arquivo seja o mesmo de um arquivo em 'pages'.

// 1. Servir o diretório de Scripts (inclui 'app.js', 'clientes.js', e a subpasta 'utils')
// Links no HTML: <script src="/utils/dados.js"></script> ou <script src="/app.js"></script>
app.use(express.static(SCRIPTS_DIR)); 

// 2. Servir o diretório de Estilos (style.css, styleClientes.css, etc.)
// Links no HTML: <link rel="stylesheet" href="/style.css">
app.use(express.static(STYLES_DIR));

// 3. Servir o diretório de Páginas. Isto é necessário para que qualquer outro arquivo
// dentro de 'pages' seja acessível diretamente se não for capturado pela rota.
app.use(express.static(PAGES_DIR));

// =======================================================
// === ROTA PRINCIPAL E OUTRAS PÁGINAS (HTML) ===
// =======================================================

// Rota principal ('/') para carregar index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'index.html'));
});

// Rotas para suas outras páginas HTML
app.get('/clientes', (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'clientes.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'dashboard.html'));
});

app.get('/usuarios', (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'usuarios.html'));
});

// =======================================================
// === INICIAR SERVIDOR ===
// =======================================================

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});