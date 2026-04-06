# 🍏 iFound

O **iFound** é uma plataforma moderna e responsiva cujo propósito é ajudar a comunidade em Portugal a relatar, gerir e recuperar dispositivos e outros artigos perdidos/achados, com especial destaque para equipamentos do ecossistema Apple. Emana uma experiência premium, baseada no próprio *design system* da Apple (Glassmorphism, cores minimalistas e tipografia polida).

---

## 🚀 Tecnologias e Stack
O sistema foi desenvolvido de forma modular através duma arquitetura Full-Stack

### Frontend (User Interface)
* **Angular (v17+)**: Frame de alto desempenho com navegação dinâmica (SPA), configurado com Standalone Components (sem módulos).
* **Tailwind CSS**: A espinha dorsal visual. Permite criações rápidas de UIs super sofisticadas sem abandonar o ficheiro HTML/TS.
* **Vercel Deploy**: Otimizado para alojamento contínuo em servidores Vercel de rápida latência global (Edge Networks). 

### Backend (API e Motor Central)
* **Node.js & Express.js**: Criação robusta e minimalista das portas e serviços HTTP.
* **MongoDB & Mongoose**: Base de dados Não-Relacional assente em estruturas de objetos, garantindo alta flexibilidade sem tabelas engessadas.
* **JSON Web Tokens (JWT)**: Segurança apurada na validação das sessões de utilizador.
* **Render Deploy**: Assente ativamente para gerir infraestruturas Node contínuas (Web Services) respondendo autonomamente a picos de tráfego.

---

## 🔒 Segurança e Privacidade (2FA & RGPD)

A aplicação compromete-se intensamente em manter a transparência e segurança:

1. **Armazenamento Criptografado**: Todas as passwords encontram-se seladas via algoritmos unitários de *Hashing* pela biblioteca `bcrypt.js`.
2. **Duplo Fator de Autenticação Automático (2FA)**: Tanto no Registo, como no Início de Sessão, a identidade do utilizador fica restringida temporariamente perante a nossa API, até que o mesmo valide num Ecrã Angular o Código de 6-dígitos emitido exclusivamente pelo nosso transponder de Email.
3. **Bloqueio RGPD**: Novos registos impedem nativamente a gravação se o consentimento de Privacidade for recusado, com validação de duplicidade entre Emails e números NIF em rotinas de *middleware*.

---

## 🏗️ Estrutura do Monorepo

O projeto engloba ambs as tecnologias no mesmo repositório sob duas diretorias principais:

```bash
📦 ifound
 ┣ 📂 backend
 ┃ ┣ 📂 models     # Esqueletos/Schemas do MongoDB
 ┃ ┣ 📂 routes     # Portas públicas disponíveis do nosso Express
 ┃ ┣ 📜 server.js  # Motor principal, inicialização da Database e Express
 ┃ ┗ ...
 ┣ 📂 frontend
 ┃ ┣ 📂 src
 ┃ ┃ ┣ 📂 app
 ┃ ┃ ┃ ┣ 📂 pages    # Componentes independentes visuais (ex: Login, Dashboard)
 ┃ ┃ ┃ ┗ 📂 services # Lógica de chamada e abstração de Pedidos HTTP em RXJS
 ┃ ┃ ┗ 📜 tailwind.config.js # Centralização de cores e tokens de Design Apple
 ┃ ┗ ...
 ┗ 📜 README.md
```

---

## 🛠️ Como Iniciar este Projeto Localmente

1. **Pré-requisitos**: Garante que tens o `Node.js` v18+ instalado;
2. **Clonar**: Extrai ou clona o Repositório do GitHub;

### Correr a Base de Dados / Backend
1. Navega do terminal para `cd backend`
2. Instala dependências: `npm install`
3. Cria um ficheiro `.env` com recurso ao original de exemplo chamado `.env.example`
4. Preenche as tuas variáveis MongoDB, a tua chave JWT secreta, e e-mail SMTP.
5. Inicia o servidor e verifica a sua escuta: `npm start` *(Ficará na porta 5000)*

### Correr a Interface (Site)
1. Navega do terminal para `cd frontend`
2. Instala os blocos Angular e CSS: `npm install`
3. Executa a compilação local (dev env): `npm start` *(ou `ng serve`)*
4. O browser abrirá diretamente em `http://localhost:4200/` ligado ao teu backend local.

---
Desenvolvido focado no detalhe. Protegido tecnologicamente. 🍏
