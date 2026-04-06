# iFound - Documentação Exclusiva para Administrador 🔐

Este ficheiro foi criado para que nunca percas o fio à meada do teu próprio projeto. Detalha a "lógica por trás das cortinas", o porquê de termos tomado certas opções de arquitetura, e como funcionam as chaves secretas do teu projeto. 

Se num futuro tiveres problemas, este documento deverá ser o teu farol de salvação.

---

## 🧠 1. Decisões de Arquitetura e o "Porquê"

### 1.1 Porque dividimos o Frontend do Backend?
Poderíamos ter feito tudo junto (o chamado *Server-Side Rendering*), mas separar o projeto num Frontend (Angular) e Backend (Node.js) traz duas vantagens vitais para ti:
1. **Contornar Limitações Financeiras:** Como só podes ter 1 projeto gratuito no Render (que corre processos Node.js), ao separar, conseguimos alojar a interface visual numa plataforma de sites estáticos absurdamente generosa de limites como o **Vercel** ou Netlify! Assim manténs o teu custo a 0€.
2. **Escalabilidade (Bónus):** Se no futuro quiseres criar uma app para iOS nativa, o teu Backend continua o mesmo. A app de iPhone só tem de voltar a pedir os mesmos acessos às mesmas portas (`/api/auth`).

### 1.2 Porquê CORS (`CLIENT_URL`)?
CORS (Cross-Origin Resource Sharing) é uma política de segurança dos browsers. Se um hacker criar um site chamado "ifound-falso.com" e tentar fazer pedidos pela calada ao teu backend (agora alojado no Render), o teu backend atira um erro de permissão imediato porque nós mandámo-lo bloquear estranhos. O backend só confia nos acessos que vêm do link que tu colocaste no `CLIENT_URL`.

### 1.3 Porquê JWT e não Sessões?
Utilizamos **JSON Web Tokens (JWT)**. Porquê? Se utilizássemos *Sessões* baseadas na Base de Dados, o teu servidor iria consumir muito mais RAM grátis no Render por cada utilizador que deixasse o separador aberto. Com JWT, o servidor emite um "Crachá Criptográfico". Quando o utilizador volta amanhã, o servidor diz: "Mostra-me o crachá!". Se a assinatura for a tua, ele acredita de imediato sem ter de aceder à Base de Dados para confirmar.

---

## 🔑 2. O Cofre das Chaves Secretas (API Keys e Tokens)

Esta secção contém a explicação de cada variável que inseres no `.env` (ou na dashboard do teu Alojamento).

| Variável | Dificuldade / Criticidade | Explicação do Funcionamento |
| :--- | :--- | :--- |
| **`MONGODB_URI`** | 🔴 Crítico | É o bilhete dourado do MongoDB Atlas. Contém o teu username e password dentro do próprio link (`mongodb+srv://user:pass@cluster...`). Se alguém obtiver isto, pode apagar e roubar todos os registos, chats e acessos dos teus utilizadores na Base de Dados. |
| **`JWT_SECRET`** | 🔴 Crítico | Usado para assinar os crachás dos utilizadores. Se for descoberto, um atacante pode assinar um crachá manualmente no seu terminal e criar acessos forjados que o teu servidor vai acreditar que são legítimos. Por isso tem de ser um texto longo aleatório, inatingível. |
| **`CLIENT_URL`** | 🟡 Baixa | O endereço público do teu site (ex: `https://ifound.zerodown.top`). Avisa o backend: "*Eu conheço este site, não lhe atires um bloqueio CORS.*" Na arquitetura Docker com nginx proxy, CORS não é necessário (same-origin). |
| **`SMTP_HOST` & `PORT`** | 🟢 Aviso | Os endereços técnicos do carteiro que contratares. Se for o Gmail, é `smtp.gmail.com` na porta `465`. |
| **`SMTP_USER` & `PASS`** | 🔴 Crítico | As credenciais do email. *Aviso para contas Gmail:* Não metas a tua password do dia-a-dia! Tens de ir à tua conta Google, ativar a autenticação em 2 Passos, e criar uma "App Password" específica com 16 letras só para este site. |
| **`MAIL_FROM`** | 🟢 Info | Opcional. Apenas usado visualmente para as pessoas perceberem quem enviou o email de recuperação (ex: `no-reply@ifound-app.pt`). Se estiver vazio, ele usa o `SMTP_USER`. |

---

## 🛠️ 3. Lógica Falha-Seguro (Modo Dev e Atrasos do Render)

Existem duas particularidades lógicas implementadas que precisas de saber para não empanicares no futuro:

### 3.1 O "Adormecimento" do Render (Cold Start)
O Render desliga o teu backend na versão *Free* após 15 minutos sem receber ninguém. **O Porque?** Eles poupam dinheiros nos servidores libertando recursos das apps que não estão a ser usadas. 
**O Efeito:** Quando abrires o teu site e tentares fazer Log-in ou ir buscar ocorrências à primeira vez do dia, o pedido pode demorar até **50 segundos** a obter resposta! Não tens nenhum erro no código, ele está literalmente a executar o comando `node server.js` numa máquina fria de novo. Os restantes pedidos a partir daí já são relâmpago.

### 3.2 O Fallback do 2FA Local
Se um dia o teu serviço de Email falhar ou o Google mudar restrições SMTP e deitares o site abaixo... não perdes tudo!
Implementámos estrategicamente um `catch`/fallback de erro nas funções `send2FAEmail()`. Significa que, se ele encontrar um erro que indique ausência de email (*SMTP não configurado*), ele contorna enviando o código secreto **diretamente nos pacotes HTTP da Resposta da API**. Assim consegues sempre ligar a app no teu `localhost` local e testar acessos, porque o código chegará à Consola do Desenvolvedor de forma transparente para ti.
