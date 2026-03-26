const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization") || req.query.token;

  if (!token) {
    return res.status(401).json({ message: "Acesso negado. Token nao fornecido." });
  }

  try {
    const verified = jwt.verify(token.split(" ")[1] || token, process.env.JWT_SECRET || "default_secret_key");
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: "Token invalido." });
  }
};

module.exports = authMiddleware;
