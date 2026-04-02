# Deploy do Backend no Render

Como o Render oferece um plano gratuito muito bom para iniciar (embora com limite de um Web Service gratuito) e tu já confirmaste que tens uma vaga, é uma excelente opção para o backend do "Ifound", por correr nativamente servidores Node.js.

O código atual no `server.js` já está perfeitamente preparado para o Render, porque utiliza `process.env.PORT`, que é a variável que o Render injeta automaticamente.

## Passos para fazer Deploy no Render

### 1. Preparar o Repositório
O teu projeto já deve estar no GitHub. Certifica-te de que a pasta `backend` e o `package.json` estão na origem, ou, como este é um projeto monorepo (onde tens frontend e backend do mesmo repositório), terás que especificar a pasta de raiz do backend no Render.

### 2. Criar o Web Service
1. Vai a [render.com](https://render.com) e faz login com o teu GitHub.
2. Clica em **New > Web Service**.
3. Seleciona o repositório do "Ifound" da tua conta GitHub.

### 3. Configurar o Web Service
Preenche os dados da seguinte forma:
- **Name**: `ifound-backend` (ou o que preferires)
- **Region**: Seleciona `Frankfurt (EU)` (ou a mais próxima de ti, para menor latência)
- **Branch**: `main` (ou a branch principal que estás a usar)
- **Root Directory**: `backend` *(MUITO IMPORTANTE! Diz ao Render onde está o package.json do backend)*
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start` (ou `node server.js`)
- **Instance Type**: Seleciona a opção **Free**

### 4. Configurar Variáveis de Ambiente (Environment Variables)
Ainda nas definições da criação do serviço, clica em **Advanced** e adiciona as seguintes variáveis de ambiente, que devem ser iguais às do teu ficheiro `.env` local:

| Key | Value (Exemplo) |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://...` (A tua string do MongoDB) |
| `JWT_SECRET` | *(Introduz o teu secret)* |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `o.teu.email@gmail.com` |
| `SMTP_PASS` | `tua-pass-de-app` |
| `CLIENT_URL` | Trabalharemos nisto quando alojares o frontend, mas será o link do teu frontend (ex. `https://ifound-app.vercel.app`) para configurar o CORS adequadamente. |

*(Não precisas de adicionar PORT, o Render gere isso sozinho).*

### 5. Finalizar Deploy
1. Clica no botão **Create Web Service**.
2. O Render fará o log na consola instalando dependências (`npm install`) e de seguida iniciando o servidor (`npm start`).
3. Obterás um link no final, como por exemplo: `https://ifound-backend-xyz.onrender.com`.  

---

### Dica Importante sobre o Plano Gratuito
O plano free do Render tem uma característica (Cold Start): **após 15 minutos sem receber pedidos, o servidor adormece**. 
Quando acordar (ao receber o primeiro pedido / visita), pode demorar entre **30 a 50 segundos** a responder. Nos pedidos a seguir, a velocidade é normal (imediata). Para um projeto de portefólio isto é aceitável, basta não te desanimares na primeira chamada à API!
