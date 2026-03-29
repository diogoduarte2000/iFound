# Deploy do Backend no Railway

Este backend pode ser publicado no Railway como um servico Node separado do frontend.

## O que configurar no Railway

1. Criar um novo projeto no Railway a partir deste repositorio GitHub.
2. No servico do backend, definir o `Root Directory` para `backend`.
3. Confirmar que o Railway esta a usar o ficheiro `backend/railway.json`.
4. Gerar um dominio publico no separador de networking.

## Variaveis do backend

Obrigatorias:

- `MONGODB_URI`
- `JWT_SECRET`

Opcionais para email/2FA:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

## Ligacao com o frontend na Netlify

Depois de o backend ficar com um dominio publico, adicionar na Netlify:

- `BACKEND_API_ORIGIN=https://o-teu-backend.up.railway.app`

Em seguida, disparar um novo deploy do site na Netlify. O `netlify.toml` ja esta preparado para encaminhar `/api/*` para esse backend externo quando esta variavel existir.

## Nota importante sobre anexos do chat

O backend atual grava imagens localmente no servidor. Isso funciona melhor num servico Node dedicado do que em serverless, mas os ficheiros podem perder-se em reinicios ou novos deploys. Se os anexos forem importantes, o proximo passo ideal e mover isso para um storage persistente.
