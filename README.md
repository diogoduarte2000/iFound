# 🍏 iFound — Plataforma de Perdidos e Achados para Portugal

**iFound** é uma plataforma web moderna para relatar, gerir e recuperar **dispositivos e artigos perdidos/achados** em Portugal, com suporte especial para equipamentos Apple. Oferece uma experiência premium baseada no *design system* Apple com Glassmorphism, cores minimalistas e tipografia elegante, permitindo que a comunidade portuguesa collaborate para encontrar bens de forma segura e eficiente.

> ℹ️ **NOTA**: Este repositório GitHub é um **espelho/protótipo** do projeto. O **desenvolvimento ativo** está a decorrer localmente. Para colaborações ou perguntas, contacte o owner.

---

## 🎯 Funcionalidades Principais

- **📱 Publicações de Perdidos/Achados**: Regista dispositivos perdidos (com IMEI, cor, armazenamento) ou achados com fotos e localização
- **🔐 Autenticação Segura com 2FA**: 
  - Autenticação de dois fatores via Email (6 dígitos)
  - TOTP com Google Authenticator (opcional)
  - Dispositivos de confiança para skip de 2FA
  - Recuperação de password via email
- **💬 Chat em Tempo Real**: Comunica diretamente com outros utilizadores sobre publicações específicas (com suporte a anexos)
- **📍 Geolocalização**: Pesquisa por zona específica em Portugal (Lisboa, Porto, Covilhã, etc.)
- **🛡️ Conformidade RGPD**: Consentimento obrigatório, criptografia de passwords com bcrypt, validação de NIF
- **✅ Gestão de Status**: Publicações podem estar Ativas, Pendentes, Resolvidas ou Offline

---

## 🚀 Tecnologias e Stack

### Frontend (User Interface)
* **Angular 17+**: SPA de alto desempenho com Standalone Components (sem necessidade de NgModules)
* **Tailwind CSS**: Utility-first CSS para UIs sofisticadas sem sair do HTML
* **RxJS**: Reatividade e gestão de estado com Observables
* **TypeScript 5.4+**: Tipagem estática para código robusto
* **Vercel**: Deploy contínuo com Edge Networks para latência global mínima

### Backend (API e Motor Central)
* **Node.js v18+** com **Express.js 5.2+**: Serviços HTTP robustos e minimalistas
* **MongoDB + Mongoose 9+**: Base de dados NoSQL com esquemas flexíveis e validação
* **JWT (JSON Web Tokens)**: Autenticação stateless e segura com tokens criptografados
* **bcryptjs 3.0+**: Hashing seguro de passwords
* **Nodemailer 8.0+**: Envio de emails (2FA, recuperação de password)
* **Speakeasy + QR Code**: Geração de TOTP e códigos QR para autenticação 2FA
* **Render**: Hosting escalável para Node.js com suporte a workers em cluster
* **Docker + Docker Compose**: Orquestração de containers (nginx, backend, MongoDB)


---

## 🔒 Segurança e Privacidade

A aplicação implementa múltiplas camadas de segurança:

### Autenticação & Autorização
- **JWT Stateless**: Tokens assinados que não requerem sessão no servidor — escalável e eficiente
- **Hashing com bcrypt**: Passwords nunca são armazenadas em texto plano
- **2FA Multi-Método**: 
  - Email com código 6-dígitos (expire em 60 segundos)
  - TOTP com Google Authenticator (baseado em tempo)
  - Códigos de backup para recuperação
  - Dispositivos de confiança para UX melhorada
- **Validação robusta com express-validator**: Cleansing e sanitização de todos os inputs

### Privacidade (RGPD)
- Consentimento obrigatório durante o registo
- Validação de duplicidade (Email + NIF)
- Middleware de proteção de rotas
- CORS configurável para prevenir abusos de origem cruzada
- Armazenamento seguro de dados sensíveis

### Conformidade & Best Practices
- Tokens JWT com expiração configurável
- Falback seguro para 2FA em caso de falha SMTP
- Recuperação de password com token seguro
- Logs estruturados de eventos críticos


---

## 🏗️ Arquitetura e Estrutura do Monorepo

O projeto segue uma arquitetura **Full-Stack moderna** com separação clara entre camadas:

```bash
📦 ifound/
 ┣ 📂 backend/                    # Node.js + Express API
 ┃ ┣ 📂 models/                  # Mongoose schemas (User, Publication, Chat)
 ┃ ┣ 📂 routes/                  # Portas API (/auth, /posts, /chats, /devices)
 ┃ ┣ 📂 middleware/              # Auth middleware, TOTP validation
 ┃ ┣ 📂 utils/                   # Helpers (2FA, IMEI validation)
 ┃ ┣ 📂 storage/                 # Chat attachments storage
 ┃ ┣ 📜 server.js                # Entry point com clustering
 ┃ ┣ 📜 app.js                   # Configuração Express (rotas, CORS)
 ┃ ┣ 📜 db.js                    # Conexão MongoDB + validações
 ┃ ┗ 📜 package.json             # Dependências backend
 ┃
 ┣ 📂 frontend/                   # Angular 17+ SPA
 ┃ ┣ 📂 src/app/
 ┃ ┃ ┣ 📂 pages/                 # Componentes visuais (Login, Dashboard, Chats, etc)
 ┃ ┃ ┣ 📂 services/              # Logic & HTTP abstraction (Auth, Chat, Publication)
 ┃ ┃ ┣ 📂 shared/                # Dados compartilhados (localizações PT)
 ┃ ┃ ┣ 📜 app.routes.ts          # Definição de rotas SPA
 ┃ ┃ ┗ 📜 app.config.ts          # Httpinterceptors, providers globais
 ┃ ┣ 📜 tailwind.config.js        # Design tokens (cores, tipografia Apple)
 ┃ ┣ 📜 angular.json              # Build config
 ┃ ┗ 📜 package.json              # Dependências frontend
 ┃
 ┣ 📜 docker-compose.yml          # Orquestração: nginx + backend + MongoDB
 ┣ 📜 nginx.conf                  # Proxy reverso para SPA + API
 ┗ 📜 README.md                   # Este ficheiro

```

### Fluxo de Dados
```
Cliente (Browser)
    ↓
Angular SPA (Vercel)
    ↓
HTTP Requests (com JWT em headers)
    ↓
Express API (Render / Docker)
    ↓
MongoDB (Atlas / Docker)
```

### Rotas Principais API
- **`/api/auth`**: Registo, login, 2FA verification, password recovery
- **`/api/posts`**: Criar/listar publicações (perdidos/achados)
- **`/api/chats`**: Criar chats, enviar mensagens com attachments
- **`/api/devices`**: Gerir dispositivos de confiança
- **`/api/status`**: Health check (útil para monitorização)

---

## 🛠️ Guia de Instalação e Execução

### Pré-requisitos
- **Node.js 18+** (com npm/yarn)
- **Git** (para clonar)
- **MongoDB Atlas** conta (ou local MongoDB)
- **SMTP configurado** (Gmail, SendGrid, etc) - opcional para desenvolvimento local

### Setup Rápido Local

#### 1️⃣ Clone e Dependências
```bash
# Clone o repositório
git clone https://github.com/seu-user/ifound.git
cd ifound

# Instale dependências do backend
cd backend
npm install

# Instale dependências do frontend (novo terminal)
cd ../frontend
npm install
```

#### 2️⃣ Configurar Backend

```bash
cd backend

# Crie um ficheiro .env baseado no exemplo
cp .env.example .env

# Edite o .env com seus dados:
# - MONGODB_URI: mongodb+srv://user:pass@cluster.mongodb.net/ifound
# - JWT_SECRET: chave secreta longa e aleatória
# - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (para 2FA por email)
# - CLIENT_URL: http://localhost:4200 (para CORS em dev)
```

**Inicie o backend:**
```bash
npm start
# Servidor rodará em http://localhost:5000
# Verificar saúde: curl http://localhost:5000/api/status
```

#### 3️⃣ Configurar Frontend

```bash
cd frontend

# Servidor de desenvolvimento Angular
npm start
# Abre automaticamente http://localhost:4200/
```

### Setup com Docker Compose (Recomendado para Produção)

```bash
# No raiz do projeto
docker compose up -d

# Serviços disponíveis:
# - nginx (porta 80/443): SPA + API proxy
# - backend (porta 5000, interno): Express API
# - mongodb (porta 27017, interno): Base de dados
```

---

## 📚 Endpoints Principais da API

### Autenticação
- `POST /api/auth/register` — Registo com 2FA pendente
- `POST /api/auth/login` — Login (retorna JWT)
- `POST /api/auth/verify-2fa` — Verificar código 2FA
- `POST /api/auth/setup-totp` — Ativar Google Authenticator
- `POST /api/auth/forgot-password` — Iniciar recuperação de password

### Publicações (Perdidos/Achados)
- `GET /api/posts` — Listar todas as publicações
- `POST /api/posts` — Criar nova publicação
- `GET /api/posts/:id` — Detalhes de publicação
- `PATCH /api/posts/:id` — Editar publicação (autor)
- `DELETE /api/posts/:id` — Eliminar publicação

### Chats
- `GET /api/chats` — Listar chats do utilizador
- `POST /api/chats` — Criar novo chat numa publicação
- `GET /api/chats/:id` — Obter mensagens do chat
- `POST /api/chats/:id/messages` — Enviar mensagem com anexos

### Dispositivos (Confiança)
- `GET /api/devices` — Listar dispositivos de confiança
- `POST /api/devices` — Registar novo dispositivo
- `DELETE /api/devices/:id` — Remover dispositivo

---

## 🌍 Rotas Frontend (Angular SPA)

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/login` | LoginComponent | Página de autenticação |
| `/register` | RegisterComponent | Criação de conta |
| `/forgot-password` | ForgotPasswordComponent | Recuperação de senhas |
| `/2fa/setup` | TwoFASetupComponent | Configuração de 2FA (TOTP) |
| `/dashboard` | DashboardComponent | Home com resumo e filtros |
| `/conversas` | ChatsComponent | Gestor de chats em tempo real |
| `/minhas-publicacoes` | MyPublicationsComponent | Publicações do utilizador |

---

## 🚀 Deployment

### Frontend (Vercel)
```bash
# Vercel automaticamente detecta Angular e faz build
git push origin main  # Trigger automático no Vercel
```

### Backend (Render.com)
```bash
# Conecte Render ao repositório
# Render detecta Node.js e corre: npm install && npm start
```

### Variáveis de Ambiente Críticas

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `MONGODB_URI` | 🔴 Crítico | `mongodb+srv://user:pass@cluster...` |
| `JWT_SECRET` | 🔴 Crítico | `sua-chave-secreta-muito-longa` |
| `CLIENT_URL` | 🟡 Médio | `https://ifound.app` |
| `SMTP_HOST` | 🟢 Opcional | `smtp.gmail.com` |
| `SMTP_PORT` | 🟢 Opcional | `465` |
| `SMTP_USER` | 🟢 Opcional | `seu-email@gmail.com` |
| `SMTP_PASS` | 🟢 Opcional | `app-password-de-16-caracteres` |

---

## ⚙️ Status de Desenvolvimento

- **Ambiente Local**: `F:\Nova pasta\Ifound` (Development)
- **Repositório GitHub**: Espelho/Protótipo para showcase
- **Status**: 🔨 Em desenvolvimento ativo
- **Próximos Passos**: Beta testing, documentação de API, testes unitários

Este repositório serve principalmente como **vitrine técnica** do projeto. O código-fonte real com histórico de commits está no servidor de desenvolvimento local.

---

## 🤝 Contribuir

1. Faça fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/minha-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

---

## 📖 Documentação Adicional

- [README ADMIN](README_ADMIN.md) — Configuração e decisões de arquitetura
- [Docker Compose](docker-compose.yml) — Setup de containers
- [Nginx Config](nginx.conf) — Proxy reverso e SPA serving

---

## 📄 Licença

Este projeto está sob licença ISC. Veja LICENSE para detalhes.

---

**Desenvolvido com ❤️ para a comunidade portuguesa.**  
*Segurança. Privacidade. Comunidade.*  
🍏 **iFound — Encontre o que perdeu!**
