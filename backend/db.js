require("dotenv").config();
const mongoose = require("mongoose");

const DEFAULT_LOCAL_MONGODB_URI = "mongodb://127.0.0.1:27017/ifound";

let connectionPromise = null;

const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" || Boolean(process.env.NETLIFY);

const isDatabaseConfigured = () =>
  Boolean(process.env.MONGODB_URI) || !isProductionRuntime();

const getMongoUri = () => {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  if (isProductionRuntime()) {
    const error = new Error("MONGODB_URI_NOT_CONFIGURED");
    error.code = "MONGODB_URI_NOT_CONFIGURED";
    throw error;
  }

  return DEFAULT_LOCAL_MONGODB_URI;
};

const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(getMongoUri()).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
  return mongoose.connection;
};

module.exports = {
  connectToDatabase,
  isDatabaseConfigured,
  isSmtpConfigured,
};
