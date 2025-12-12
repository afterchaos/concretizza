# 🔒 Guia de Segurança - Concretizza

Este documento descreve as implementações de segurança aplicadas ao projeto Concretizza.

## 🔐 Implementações de Segurança

### 1. **Autenticação com JWT**
- Todas as rotas de API agora requerem um token JWT válido no header `Authorization: Bearer <token>`
- O token expira após 24h (configurável via `.env`)
- Tokens são gerados apenas após login bem-sucedido

### 2. **Hash de Senhas**
- Senhas são hasheadas com bcryptjs (10 rounds)
- Senhas nunca são armazenadas em plaintext
- Comparação segura de senhas usando bcrypt

### 3. **Validação de Entrada**
- Todos os inputs são validados com `express-validator`
- Tipos de dados são verificados no backend
- Comprimento mínimo/máximo é enforçado

### 4. **CORS Configurado**
- Apenas requisições de origens autorizadas são aceitas
- Configurável via variável de ambiente `CORS_ORIGIN`

### 5. **Rate Limiting**
- Máximo de 100 requisições a cada 15 minutos por IP
- Protege contra brute force e DDoS
- Configurável via `.env`

### 6. **Variáveis de Ambiente**
- Configurações sensíveis estão em `.env`
- `.env` está no `.gitignore` (não é commitado)
- `.env.example` serve como template

### 7. **Controle de Acesso Baseado em Cargo (RBAC)**
- `head-admin`: Controle total
- `admin`: Gerencia clientes e visualiza logs
- `editor`: CRUD de clientes
- `visualizar`: Apenas leitura de clientes

## 🚀 Como Usar

### Instalação Inicial

1. **Instalar dependências:**
```bash
npm install
```

2. **Configurar variáveis de ambiente:**
```bash
cp .env.example .env
# Edite .env e configure as variáveis conforme necessário
```

3. **Gerar dados iniciais (usuários padrão):**
```bash
npm run seed
```

4. **Iniciar servidor:**
```bash
npm start
```

### Usuários Padrão (Após Seed)

| Usuário | Email | Senha | Cargo |
|---------|-------|-------|-------|
| head | head@concretizza.com | 123456 | head-admin |
| admin | admin@concretizza.com | 123456 | admin |
| editor | editor@concretizza.com | 123456 | editor |
| viewer | viewer@concretizza.com | 123456 | visualizar |

⚠️ **IMPORTANTE**: Altere estas senhas imediatamente em produção!

## 📡 Endpoints da API

### Autenticação

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "seu_username",
  "password": "sua_senha"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "nome": "Head Admin",
    "email": "head@concretizza.com",
    "cargo": "head-admin"
  }
}
```

#### Registro
```
POST /api/auth/register
Content-Type: application/json

{
  "nome": "Novo Usuário",
  "email": "novo@exemplo.com",
  "username": "novo_usuario",
  "password": "senha_segura_com_min_6_chars"
}
```

### Clientes

Todas as rotas requerem: `Authorization: Bearer <token>`

#### Listar Clientes
```
GET /api/clientes
```

#### Criar Cliente
```
POST /api/clientes
Authorization: Bearer <token>
Content-Type: application/json

Requer permissão: create (admin, editor)

{
  "nome": "Nome do Cliente",
  "telefone": "(11) 99999-9999",
  "email": "cliente@exemplo.com",
  "interesse": "alugar|comprar|vender",
  "valor": "100000",
  "status": "novo|em-atendimento|quente|frio|finalizado",
  "observacoes": "Observações...",
  "data": "2025-12-07"
}
```

#### Atualizar Cliente
```
PUT /api/clientes/:id
Authorization: Bearer <token>
Content-Type: application/json

Requer permissão: update (admin, editor)

{
  "nome": "Nome Atualizado",
  ...
}
```

#### Deletar Cliente
```
DELETE /api/clientes/:id
Authorization: Bearer <token>

Requer permissão: delete (admin, head-admin)
```

### Usuários (Apenas para Admins)

#### Listar Usuários
```
GET /api/usuarios
Authorization: Bearer <token>

Requer permissão: admin, head-admin
```

#### Criar Usuário
```
POST /api/usuarios
Authorization: Bearer <token>
Content-Type: application/json

Requer permissão: head-admin

{
  "nome": "Novo Usuário",
  "email": "novo@exemplo.com",
  "username": "novo_user",
  "password": "senha_segura",
  "permissao": "admin|editor|visualizar",
  "status": "ativo",
  "telefone": "11999999999",
  "departamento": "Vendas"
}
```

#### Atualizar Usuário
```
PUT /api/usuarios/:id
Authorization: Bearer <token>
Content-Type: application/json

Requer permissão: head-admin

{
  "nome": "Nome Atualizado",
  "email": "email@novo.com",
  "password": "nova_senha (opcional)",
  "permissao": "admin|editor|visualizar",
  "status": "ativo|inativo",
  ...
}
```

#### Deletar Usuário
```
DELETE /api/usuarios/:id
Authorization: Bearer <token>

Requer permissão: head-admin
```

## 🛡️ Boas Práticas

### No Lado do Cliente
```javascript
// ❌ NÃO FAÇA ISTO
const usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
// dados sensíveis em localStorage podem ser acessados via XSS

// ✅ FAÇA ASSIM
// Use a função da api.js
const clientes = await obterClientes()
// token é enviado automaticamente no header
```

### No Lado do Servidor
```javascript
// ❌ NÃO FAÇA ISTO
app.get("/api/usuarios", (req, res) => {
  // sem autenticação!
  db.all("SELECT * FROM usuarios", ...)
})

// ✅ FAÇA ASSIM
app.get(
  "/api/usuarios",
  autenticar,
  autorizar("admin", "head-admin"),
  (req, res) => {
    db.all("SELECT * FROM usuarios", ...)
  }
)
```

## 🔑 Variáveis de Ambiente

```env
# Porta do servidor
PORT=3000

# Ambiente (development/production)
NODE_ENV=development

# Chave JWT (mude para produção!)
JWT_SECRET=sua_chave_jwt_super_secreta_aqui_min_32_caracteres

# Tempo de expiração do token
JWT_EXPIRE=24h

# Rounds de bcrypt (mais = mais seguro mas mais lento)
BCRYPT_ROUNDS=10

# Caminho do banco de dados
DB_PATH=./concretizza.db

# Origem permitida para CORS
CORS_ORIGIN=http://localhost:3000

# Rate limiting (em minutos)
RATE_LIMIT_WINDOW=15

# Máximo de requisições por janela
RATE_LIMIT_MAX_REQUESTS=100
```

## 📋 Checklist de Produção

- [ ] Alterar `JWT_SECRET` para uma chave aleatória forte
- [ ] Mudar `NODE_ENV` para `production`
- [ ] Alterar senhas padrão dos usuários
- [ ] Configurar `CORS_ORIGIN` com URL correta
- [ ] Usar HTTPS (não HTTP)
- [ ] Configurar backups automáticos do banco de dados
- [ ] Monitorar logs de erro
- [ ] Configurar rate limiting mais restritivo se necessário
- [ ] Revisar permissões de usuários

## 🐛 Segurança Residual

Apesar das implementações, ainda há melhorias possíveis:

- [ ] Implementar refresh tokens
- [ ] Adicionar two-factor authentication (2FA)
- [ ] Logs de auditoria completos
- [ ] Criptografia de dados sensíveis no banco
- [ ] WAF (Web Application Firewall)
- [ ] Monitoring e alertas de segurança

## 📞 Suporte

Para dúvidas ou problemas de segurança, entre em contato com o time de desenvolvimento.
