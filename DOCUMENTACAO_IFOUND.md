# Documentação do Projeto: iFound

O **iFound** é uma plataforma inovadora baseada na web, planeada e estruturada para permitir que cidadãos em Portugal relatem, giram e recuperem objetos perdidos e achados (com principal foco em dispositivos Apple como iPhones). Construída de ponta a ponta ("Full-stack"), a aplicação caracteriza-se por uma interface extremamente elegante "Apple-like" aliada a um *Backend* robusto, seguro e dotado de duplo fator de autenticação (2FA).

---

## 🏗️ 1. Arquitetura do Sistema

O sistema está dividido de forma clássica em duas grandes metades, o que permite o desenvolvimento independente das partes visual (Front-end) e processual (Back-end) do sistema. O tráfego e lógica de negócio são encaminhados via APIs REST.

### 1.1 Backend (A Espinha Dorsal)
O Backend encontra-se na diretoria `/backend`. Este pedaço do software não tem interface gráfica; corre discretamente num servidor a receber pedidos HTTP e a comunicar com a base de dados.

**Tecnologias Usadas:**
*   **Node.js & Express.js:** O motor principal. Permite-nos escrever lógica de servidor (tratar ficheiros, enviar emails e criar a API RESTful) com a linguagem JavaScript. O `Express` lida com o *routing* (as rotas/URLs de entrada dos dados).
*   **Mongoose & MongoDB:** A base de dados principal é Não-Relacional (NoSQL). O `Mongoose` atua como intermédio, permitindo-nos estabelecer regras fixas de modelação de dados (ver `models/User.js`). Ao contrário do SQL, guarda os dados num formato semelhante a JSON.
*   **JSON Web Tokens (JWT):** A tecnologia vital que autentica as sessões do utilizador, gerando uma "chave mestra" digital de acesso provisório (que dura 1 dia nas configurações atuais), evitando teres de guardar a sessão em disco no servidor.
*   **Bcrypt.js:** Toda a palavra-passe que entra na base de dados é primeiramente irreconhecível. Esta biblioteca efetua processos de *Hashing* unilaterais e com *Salting*, para que, no caso da Base de Dados ser roubada, as passwords continuem indecifráveis.
*   **Nodemailer:** Utilizado como o Carteiro Automático. Sempre que é chamado (por exemplo num pedido 2FA ou recuperação de passe), ele enverga uma ligação SMTP a um email real e envia relatórios e códigos para caixas de correio alheias.

### 1.2 Frontend (O Interface de Utilizador)
Localizado na diretoria `/frontend`, lida com tudo em que o utilizador clica, lê ou interage.

**Tecnologias Usadas:**
*   **Angular (v17+):** A poderosa framework mantida pelo Google. Trabalha ativamente o chamado projeto "Single Page Application" (SPA) — o website é carregado no browser apenas uma vez. Conforme navegas no iFound, o ecrã desenha os pedaços sozinho através do *Angular Router*, fornecendo rotas e tempos de resposta instantâneos sem recarregos visíveis. Foi gerado à base de *Standalone Components* (um standard moderno que prescinde de pesados ficheiros de módulos transversais antigos).
*   **Tailwind CSS:** Foi aqui que moldámos por completo o design. O Tailwind permite que o estilo seja feito diretamente no ficheiro HTML com nomes de classes super rápidos. Graças a ele, foi possível compor *Glassmorphisms* transparentes que emulam os efeitos visuais do iOS/macOS.
*   **RxJS (Reactive Extensions):** Empregada em quase tudo no Angular. Mantém canais "reativos" abertos (vulgo *Observables*) permitindo à interface interagir graciosamente nos longos tempos de carregamento de pedidos da rede (`HttpClient`).

---

## 🔒 2. A Camada de Segurança e Fluxos

A identidade dos utilizadores e o fluxo de dados foram programados para operar sobre preceitos rígidos de segurança.

**O Fluxo de Autenticação Dupla (2FA):**
1. O utilizador vai à Página inicial no *Angular* e mete as credenciais.
2. O Angular avisa a porta `/auth/login` do _Express_.
3. A _API_ desencripta parcialmente a palavra-passe e valida. Se for válida, não deixa o utilizador entrar logo, mas sim: retém e envia um código `2FA` numérico temporal para a caixa de *email* dele (através do *Nodemailer*), expirando passado `10 minutos`.
4. O *Angular* deteta este segundo pedido (Mudança de ecrã/Step 2) e aguarda o Input. Ao ser retornado e validado o input pela porta `/auth/verify-2fa`, a API confia inteiramente e larga a "Chave JWT" para o *Angular*.

**Recuperação e Consentimento:**
Houve particular foco no RGPD no código de Registo e a Base de Dados exige que o parâmetro `rgpdConsent` transite na rede antes duma conta ser constituída. Similar às credenciais de log-in, todo o Reset de Palavras-passe obriga a um pedido exterior via token (`code`).

---

## 🍎 3. Identidade Visual (Design System Apple)

O sistema de identidade visual foi codificado à lupa na fase 2 de desenvolvimento.

**Tipografia e Cores Base:**
*   Implementou-se a *font-family* System-Apple como fonte principal (caindo para a *Inter* global nos browsers vulgares de Windows).
*   Substituição das paletas ruidosas por sólidos neutros como o *Apple Light Gray* (`#f5f5f7`) e azuis de destaque vítreos (`#0066cc`).

**Componentes-Chave:**
*   **Dashboard / Publicações**: Modelado com fundos altamente espaçados, sem bordas grotescas mas com *shadows* translúcidos que empurram os cartões da página `(shadow-[0_8px_30px_rgb(0,0,0,0.04)])`.
*   **Caixas de Entrada (Chats)**: Criámos uma dualidade de layout no qual as Listas de Contactos à esquerda pousam em superfícies brancas com pormenores neutros e a secção onde as conversas se dão ganha ênfase visual (similar ao ecossistema Mac/iMessage/Mail).

---

## 📂 4. Diretórios Resumidos do Projeto

*   **`backend/`**
    *   `/models/`: Esqueletos/Regras dos Objetos a ir para a Database. (Ex: o molde base do que é um `User`)
    *   `/routes/`: As portas da rua abertas do API que decidem para onde os pedidos HTTP vão.
    *   `server.js`: O Big Boss. O coração do Backend que arranca tudo e liga até ao MongoDB.
    *   `.env`: Ficheiros muito privados não levados ao GitHub (como Palavras Passes ou chaves AWS, SMTP).

*   **`frontend/`**
    *   `src/app/pages/`: Os ecrãs visualizados da aplicação. (*Dashboard, MyPublications, Register, Login, Chats, Forgot-Password*).
    *   `src/app/services/`: Os trabalhadores sem cara (*ex: auth.service.ts*) cuja função é apenas "chamar via internet" pelas promessas e pedidos da API do Backend, e expor perante as *Pages*.
    *   `src/app/app.routes.ts`: O Mapa digital da Aplicação em formato de rotina para que o Angular saiba que `/login` conduz sempre ao Componente `<app-login>`.

---
*Este ficheiro foi documentado a partir das decisões tecnológicas ativas, pronto para ajudar futuras expansões da equipa no iFound!*
