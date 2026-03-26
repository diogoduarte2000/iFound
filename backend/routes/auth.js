const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const router = express.Router();

const generate2FACode = () => Math.floor(100000 + Math.random() * 900000).toString();

const getMailTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const send2FAEmail = async (email, code) => {
  try {
    const transporter = getMailTransporter();
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: email,
      subject: "Seu codigo de acesso Ifound",
      text: `O seu codigo de acesso Ifound e: ${code}\n\nEste codigo expira em 10 minutos.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Ifound</h2>
          <p>O seu codigo de acesso e:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${code}</p>
          <p>Este codigo expira em 10 minutos.</p>
        </div>
      `,
    });

    return { deliveryMode: "email" };
  } catch (error) {
    if (error.message === "SMTP_NOT_CONFIGURED") {
      console.warn("SMTP nao configurado. A devolver codigo 2FA em modo local.");
      return { deliveryMode: "dev", devCode: code };
    }

    throw error;
  }
};

router.post("/register", async (req, res) => {
  try {
    const { email, password, nif, rgpdConsent } = req.body;

    if (!rgpdConsent) {
      return res.status(400).json({ message: "E obrigatorio aceitar a Politica de Privacidade." });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Este email ja esta registado." });
    }

    const existingNif = await User.findOne({ nif });
    if (existingNif) {
      return res.status(400).json({ message: "Este NIF ja esta registado." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      email,
      passwordHash,
      nif,
      rgpdConsent,
      isVerified: false,
    });

    await newUser.save();

    const code = generate2FACode();
    newUser.twoFactorSecret = code;
    newUser.twoFactorExpires = new Date(Date.now() + 10 * 60000);
    await newUser.save();

    const delivery = await send2FAEmail(newUser.email, code);

    res.status(201).json({
      message:
        delivery.deliveryMode === "email"
          ? "Registo concluido com sucesso. Verifique o seu email para o codigo de acesso."
          : "Registo concluido com sucesso. SMTP nao configurado; o codigo sera disponibilizado no login local.",
      email: newUser.email,
      ...delivery,
    });
  } catch (error) {
    console.error(error);
    if (error?.code === 11000 && error?.keyPattern?.email) {
      return res.status(400).json({ message: "Este email ja esta registado." });
    }
    if (error?.code === 11000 && error?.keyPattern?.nif) {
      return res.status(400).json({ message: "Este NIF ja esta registado." });
    }
    res.status(500).json({ message: "Erro no servidor durante o registo." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Credenciais invalidas." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Credenciais invalidas." });
    }

    const code = generate2FACode();
    user.twoFactorSecret = code;
    user.twoFactorExpires = new Date(Date.now() + 10 * 60000);
    await user.save();

    const delivery = await send2FAEmail(user.email, code);

    res.json({
      message:
        delivery.deliveryMode === "email"
          ? "Codigo de acesso enviado para o seu email."
          : "SMTP nao configurado. Codigo 2FA disponibilizado localmente.",
      email: user.email,
      ...delivery,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro de servidor no login." });
  }
});

router.post("/verify-2fa", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Utilizador nao encontrado." });
    }

    if (user.twoFactorSecret !== code || user.twoFactorExpires < new Date()) {
      return res.status(400).json({ message: "Codigo invalido ou expirado." });
    }

    user.isVerified = true;
    user.twoFactorSecret = null;
    user.twoFactorExpires = null;
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "default_secret_key",
      { expiresIn: "1d" }
    );

    res.json({ token, message: "Login efetuado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro na verificacao do codigo." });
  }
});

module.exports = router;
