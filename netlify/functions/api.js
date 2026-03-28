const serverless = require("../../backend/node_modules/serverless-http");

const app = require("../../backend/app");
const {
  connectToDatabase,
  isDatabaseConfigured,
  isSmtpConfigured,
} = require("../../backend/db");

const server = serverless(app, {
  basePath: "/.netlify/functions/api",
});

let warnedAboutSmtp = false;

const isHealthcheckRequest = (event) => {
  const requestPath = String(event.path || event.rawPath || "");

  return (
    requestPath === "/" ||
    requestPath === "/api/status" ||
    requestPath === "/.netlify/functions/api" ||
    requestPath.endsWith("/api/status")
  );
};

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    if (!isHealthcheckRequest(event)) {
      await connectToDatabase();
    }

    if (!warnedAboutSmtp && !isSmtpConfigured()) {
      console.warn("SMTP nao configurado. O 2FA por email nao vai funcionar.");
      warnedAboutSmtp = true;
    }

    return await server(event, context);
  } catch (error) {
    console.error("Erro ao iniciar a funcao Netlify:", error);

    const isDatabaseConfigError =
      error?.code === "MONGODB_URI_NOT_CONFIGURED" || !isDatabaseConfigured();

    return {
      statusCode: isDatabaseConfigError ? 503 : 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: isDatabaseConfigError
          ? "Backend sem acesso a base de dados. Configure MONGODB_URI na Netlify."
          : "Erro ao ligar ao backend.",
        code: isDatabaseConfigError ? "MONGODB_URI_NOT_CONFIGURED" : "BACKEND_BOOT_ERROR",
      }),
    };
  }
};
