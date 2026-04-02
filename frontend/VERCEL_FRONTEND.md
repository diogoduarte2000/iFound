# Deploy do Frontend no Vercel

O Vercel é a melhor plataforma gratuita para alojar projetos em Angular (o "site" propriamente dito), pois o plano gratuito permite alojar diversos sites estáticos sem limite de quantidade de projetos.

Ao separares tudo, usas o Render apenas para o backend e o Vercel para o site!

## Passo a Passo

Antes de alojares o site, precisas de garantir que ele sabe como comunicar com o teu backend que agora vai estar no Render.

### 1. Configurar o Frontend para usar o Backend do Render
Assim que o teu backend no Render estiver a funcionar (ele dar-te-á um link no final, como `https://ifound-backend-123.onrender.com`), tens de ir ao ficheiro **`frontend/src/app/services/api.config.ts`** e colar esse link.

Procure a variável `PRODUCTION_APIURL` e altera assim:
```typescript
const PRODUCTION_APIURL = 'https://ifound-backend-123.onrender.com'; // Exemplo
```
*Não coloques a `/` no final do URL.*

### 2. Guardar e enviar as alterações para o GitHub
Grava o ficheiro `api.config.ts` e faz push das alterações para o teu repositório no GitHub para que o Vercel consiga ler o código atualizado.

### 3. Fazer Deploy no Vercel
1. Vai a [vercel.com](https://vercel.com) e faz login com o teu GitHub.
2. Clica em **Add New...** e depois em **Project**.
3. Escolhe o repositório do "Ifound" da tua conta e clica em **Import**.

### 4. Configurar o Projeto no Vercel
Preenche da seguinte forma:
- **Project Name**: `ifound-app` (ou outro à escolha)
- **Framework Preset**: Confirma se ele detetou `Angular`. Se não detetou, escolhe Angular.
- **Root Directory**: Clica em "Edit" e escolhe a pasta `frontend`! *(Tal como no Render foi preciso dizer que era o `backend`, aqui tens de dizer que o site está na pasta `frontend`)*.

Não precisas de configurar variáveis de ambiente porque o frontend já vai ler o link diretamente do código. O Build Command (`ng build`) já vem preenchido pelo Angular.

Clica em **Deploy**! O Vercel vai instalar os pacotes, fazer a compilação de produção e gerar o teu site.

### 5. Ligar o Backend ao Novo Site (CORS) IMPORTANTE
O Vercel vai dar-te um link para o teu site (ex: `https://ifound-app.vercel.app`).
Como medida de segurança, o teu projeto "Ifound" recusa acessos se não conhecer o site que os pede.
Tens de ir agora ao teu painel do Render, às definições de **Environment** do backend, e colocar lá este link do Vercel na tua variável de ambiente chamada `CLIENT_URL`.
Exemplo: `CLIENT_URL`=`https://ifound-app.vercel.app`

Pronto! Assim tens o Backend a correr grátis no Render e o Frontend a correr grátis no Vercel e a comunicarem um com o outro!
