const serverless = require("../../backend/node_modules/serverless-http");

const app = require("../../backend/app");
const { connectToDatabase, isSmtpConfigured } = require("../../backend/db");

const server = serverless(app, {
  basePath: "/.netlify/functions/api",
});

let warnedAboutSmtp = false;

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectToDatabase();

    if (!warnedAboutSmtp && !isSmtpConfigured()) {
      console.warn("SMTP nao configurado. O 2FA por email nao vai funcionar.");
      warnedAboutSmtp = true;
    }

    return await server(event, context);
  } catch (error) {
    console.error("Erro ao iniciar a funcao Netlify:", error);

    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Erro ao ligar ao backend.",
      }),
    };
  }
};
