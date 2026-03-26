const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  
  if (!token) {
    return res.status(401).json({ message: "Acesso negado. Token não fornecido." });
  }

  try {
    // Expected format "Bearer <token>"
    const verified = jwt.verify(token.split(" ")[1] || token, process.env.JWT_SECRET || "default_secret_key");
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Token inválido." });
  }
};

module.exports = authMiddleware;
