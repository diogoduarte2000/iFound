const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const router = express.Router();

// Helper to generate 6-digit 2FA code
const generate2FACode = () => Math.floor(100000 + Math.random() * 900000).toString();

// MOCK Email sender (replace with nodemailer later if needed)
const send2FAEmail = (email, code) => {
  console.log(`\n\n[MOCK EMAIL] Para: ${email}`);
  console.log(`[MOCK EMAIL] Assunto: Seu código de acesso Perdidos & Achados`);
  console.log(`[MOCK EMAIL] Código: ${code}\n\n`);
};

// 1. REGISTO
router.post("/register", async (req, res) => {
  try {
    const { email, password, nif, rgpdConsent } = req.body;

    if (!rgpdConsent) {
      return res.status(400).json({ message: "É obrigatório aceitar a Política de Privacidade." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Este email já está registado." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      email,
      passwordHash,
      nif,
      rgpdConsent,
      isVerified: false
    });

    await newUser.save();
    
    // Generate and "Send" 2FA for initial login
    const code = generate2FACode();
    newUser.twoFactorSecret = code;
    newUser.twoFactorExpires = new Date(Date.now() + 10 * 60000); // 10 mins
    await newUser.save();
    
    send2FAEmail(newUser.email, code);

    res.status(201).json({ message: "Registo concluído com sucesso. Verifique o seu email para o código de acesso.", email: newUser.email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro no servidor durante o registo." });
  }
});

// 2. LOGIN (Step 1 - Ask for credentials, send 2FA)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Credenciais inválidas." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Credenciais inválidas." });

    // Generate 2FA
    const code = generate2FACode();
    user.twoFactorSecret = code;
    user.twoFactorExpires = new Date(Date.now() + 10 * 60000); // 10 min window
    await user.save();

    send2FAEmail(user.email, code);

    res.json({ message: "Código de acesso enviado para o seu email.", email: user.email });
  } catch (error) {
    res.status(500).json({ message: "Erro de servidor no login." });
  }
});

// 3. VERIFY 2FA (Step 2 - Receive Code, emit JWT)
router.post("/verify-2fa", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Utilizador não encontrado." });

    if (user.twoFactorSecret !== code || user.twoFactorExpires < new Date()) {
      return res.status(400).json({ message: "Código inválido ou expirado." });
    }

    // Verify User Account if hasn't been yet
    user.isVerified = true;
    user.twoFactorSecret = null;
    user.twoFactorExpires = null;
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "default_secret_key", {
      expiresIn: "1d",
    });

    res.json({ token, message: "Login efetuado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro na verificação do código." });
  }
});

module.exports = router;
