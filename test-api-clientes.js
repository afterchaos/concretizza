const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Fake JWT token para head-admin
const mockToken = 'fake-token-for-testing';

async function testClientesAPI() {
  console.log('\n🧪 Testando /api/clientes endpoint...\n');
  
  try {
    // Tentar chamar sem token
    console.log('1. Testando sem autenticação...');
    try {
      const resp = await axios.get(`${BASE_URL}/api/clientes`);
      console.log('   ❌ ERRO: Deveria ter retornado 401 Unauthorized');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.log('   ✅ Corretamente retornou status de erro (autenticação necessária)');
      } else {
        console.log(`   ⚠️  Status: ${err.response?.status}`);
      }
    }
    
    // Mostrar que o servidor está rodando
    console.log('\n2. Verificando se servidor está rodando...');
    try {
      const resp = await axios.get(`${BASE_URL}/`);
      console.log('   ✅ Servidor está respondendo');
    } catch (err) {
      console.log('   ❌ Servidor não está respondendo');
      console.log('   Inicie o servidor com: npm start');
    }
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
  
  process.exit(0);
}

testClientesAPI();
