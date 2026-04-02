const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const crypto = require("crypto");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const {
  generateTOTPSecret,
  generateQRCode,
  verifyTOTPCode,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
} = require("../middleware/totpUtils");

const router = express.Router();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "noreply@ifound.pt"; // Default sender email

const generate2FACode = () => Math.floor(100000 + Math.random() * 900000).toString();

const send2FAEmail = async (email, code) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY_NOT_CONFIGURED");
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Seu codigo de acesso Ifound",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Ifound</h2>
          <p>O seu codigo de acesso e:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${code}</p>
          <p>Este codigo expira em 60 segundos.</p>
        </div>
      `,
    });

    return { deliveryMode: "email" };
  } catch (error) {
    if (error.message === "RESEND_API_KEY_NOT_CONFIGURED") {
      console.error("Erro: RESEND_API_KEY nao configurado. Adiciona a variavel de ambiente RESEND_API_KEY no Render.");
      throw new Error("Email service not configured");
    }
    console.error("Erro ao enviar email com Resend:", error);
    throw error;
  }
};

const sendPasswordResetEmail = async (email, code) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY_NOT_CONFIGURED");
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Recuperacao de Palavra-passe Ifound",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Ifound</h2>
          <p>O seu codigo de recuperacao e:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${code}</p>
          <p>Este codigo expira em 15 minutos. Se nao pediu, pode ignorar este email.</p>
        </div>
      `,
    });

    return { deliveryMode: "email" };
  } catch (error) {
    if (error.message === "RESEND_API_KEY_NOT_CONFIGURED") {
      console.error("Erro: RESEND_API_KEY nao configurado. Adiciona a variavel de ambiente RESEND_API_KEY no Render.");
      throw new Error("Email service not configured");
    }
    console.error("Erro ao enviar email com Resend:", error);
    throw error;
  }
};

router.post("/register", async (req, res) => {
  try {
    const { email, password, nif, rgpdConsent } = req.body;

    if (!rgpdConsent) {
      return res.status(400).json({ message: "E obrigatorio aceitar a Politica de Privacidade." });
    }

    const blockedDomains = [
      "javaemail.com", "sharebot.net", "flownue.com",
      "yopmail.com", "mailinator.com", "guerrillamail.com", "tempmail.com"
    ];
    const emailDomain = email.split('@')[1].toLowerCase();
    
    if (blockedDomains.includes(emailDomain)) {
      return res.status(400).json({ message: "Fornecedores de email temporário não são autorizados na plataforma." });
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
      isVerified: true, // Email verified via RGPD consent
      twoFactorEnabled: false, // Optional to enable later
    });

    await newUser.save();

    res.status(201).json({
      message: "Registo concluido com sucesso! Faz login para continuar.",
      email: newUser.email,
      userId: newUser._id,
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

    // Generate 6-digit code and save to DB (expires in 60 seconds)
    const code = generate2FACode();
    user.twoFactorCode = code;
    user.twoFactorCodeExpires = new Date(Date.now() + 60 * 1000); // 60 seconds
    await user.save();

    // Send email with code
    try {
      await send2FAEmail(user.email, code);
    } catch (emailError) {
      console.error("Email envio falhou:", emailError);
      return res.status(500).json({ message: "Erro ao enviar codigo por email. Tenta novamente." });
    }

    // Return flag requiring 2FA verification
    res.json({
      message: "Credenciais validas. Enviamos um codigo para o teu email.",
      email: user.email,
      requiresEmailCode: true,
      twoFactorEnabled: user.twoFactorEnabled, // Flag indicating if TOTP is also available
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

router.post("/resend-2fa", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Utilizador nao encontrado." });
    }

    // Verificar se há um código ativo e se expirou
    if (!user.twoFactorSecret || user.twoFactorExpires >= new Date()) {
      return res.status(400).json({ message: "Ja existe um codigo ativo. Aguarde a expiracao ou tente novamente." });
    }

    // Gerar novo código
    const code = generate2FACode();
    user.twoFactorSecret = code;
    user.twoFactorExpires = new Date(Date.now() + 60 * 1000); // 60 segundos
    await user.save();

    const delivery = await send2FAEmail(user.email, code);

    res.json({
      message:
        delivery.deliveryMode === "email"
          ? "Novo codigo enviado para o seu email."
          : "SMTP nao configurado. Novo codigo disponibilizado localmente.",
      ...delivery,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao reenviar o codigo." });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Nenhuma conta encontrada com este email." });
    }

    const code = generate2FACode();
    user.resetPasswordSecret = code;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60000); // 15 mins
    await user.save();

    const delivery = await sendPasswordResetEmail(user.email, code);

    res.json({
      message: delivery.deliveryMode === "email" 
        ? "Codigo de recuperacao enviado para o seu email."
        : "SMTP nao configurado. Codigo disponibilizado localmente.",
      ...delivery
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao processar o pedido de recuperacao." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "A palavra-passe tem de ter no minimo 6 caracteres." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Utilizador nao encontrado." });
    }

    if (!user.resetPasswordSecret || user.resetPasswordSecret !== code || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ message: "Codigo invalido ou expirado." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = passwordHash;
    user.resetPasswordSecret = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Palavra-passe alterada com sucesso! Facar login." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao atualizar a palavra-passe." });
  }
});

// POST /resend-2fa - Resend 2FA email code (60s expiration)
router.post("/resend-2fa", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Utilizador nao encontrado." });
    }

    // Check if a valid code already exists
    if (user.twoFactorCode && user.twoFactorCodeExpires > new Date()) {
      return res.status(400).json({ message: "Ja existe um codigo ativo. Aguarda a expiracao (60 segundos)." });
    }

    // Generate new code
    const code = generate2FACode();
    user.twoFactorCode = code;
    user.twoFactorCodeExpires = new Date(Date.now() + 60 * 1000); // 60 seconds
    await user.save();

    // Send email
    try {
      await send2FAEmail(user.email, code);
    } catch (emailError) {
      console.error("Email envio falhou:", emailError);
      return res.status(500).json({ message: "Erro ao enviar codigo por email." });
    }

    res.json({
      message: "Novo codigo enviado para o teu email."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao reenviar codigo." });
  }
});

// 2FA TOTP Endpoints

// GET /2fa/setup - Initialize 2FA setup (returns QR code + secret)
router.get("/2fa/setup", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Utilizador nao encontrado." });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA ja esta ativado." });
    }

    const { secret, qrCodeUrl } = generateTOTPSecret(user.email);
    const qrCodeDataUrl = await generateQRCode(qrCodeUrl);

    // Store secret temporarily (pending confirmation)
    user.twoFactorSecret = secret;
    user.twoFactorSetupPending = true;
    await user.save();

    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      manualEntryKey: secret,
      message: "Faz scan do codigo QR com Google Authenticator ou insere a chave manualmente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao gerar codigo QR." });
  }
});

// POST /2fa/enable - Confirm 2FA setup with TOTP code
router.post("/2fa/enable", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: "Codigo invalido. Deve ter 6 digitos." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Utilizador nao encontrado." });
    }

    if (!user.twoFactorSetupPending || !user.twoFactorSecret) {
      return res.status(400).json({ message: "Nenhuma configuracao de 2FA pendente." });
    }

    // Verify the code
    const isValidCode = verifyTOTPCode(user.twoFactorSecret, code);
    if (!isValidCode) {
      return res.status(400).json({ message: "Codigo invalido. Tenta outra vez." });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(hashBackupCode);

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSetupPending = false;
    user.twoFactorBackupCodes = hashedBackupCodes;
    await user.save();

    res.json({
      message: "2FA ativado com sucesso!",
      backupCodes: backupCodes, // Send unhashed codes only once
      backupCodesMessage: "Guarda estes codigos num local seguro. Podes usa-los se perderes acesso ao Authenticator.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao ativar 2FA." });
  }
});

// POST /2fa/disable - Disable 2FA (requires password confirmation)
router.post("/2fa/disable", authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Palavra-passe necessaria para desativar 2FA." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Utilizador nao encontrado." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Palavra-passe incorreta." });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = [];
    user.twoFactorSetupPending = false;
    await user.save();

    res.json({ message: "2FA desativado com sucesso." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao desativar 2FA." });
  }
});

// GET /2fa/backup-codes/regenerate - Generate new backup codes
router.get("/2fa/backup-codes/regenerate", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Utilizador nao encontrado." });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA nao esta ativado." });
    }

    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(hashBackupCode);

    user.twoFactorBackupCodes = hashedBackupCodes;
    await user.save();

    res.json({
      message: "Novos codigos de backup gerados com sucesso.",
      backupCodes: backupCodes,
      backupCodesMessage: "Guarda estes novos codigos num local seguro.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao regenerar codigos de backup." });
  }
});

// POST /verify-2fa - Verify email code, TOTP, or backup codes
router.post("/verify-2fa", async (req, res) => {
  try {
    const { email, code, deviceId, trustDevice } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Utilizador nao encontrado." });
    }

    if (!code || code.length < 6) {
      return res.status(400).json({ message: "Codigo invalido." });
    }

    // Check if device is trusted (skip 2FA for trusted devices)
    if (deviceId) {
      const trustedDevice = user.trustedDevices.find((d) => d.deviceId === deviceId);
      if (trustedDevice) {
        trustedDevice.lastUsed = new Date();
        await user.save();

        const token = jwt.sign(
          { id: user._id, email: user.email },
          process.env.JWT_SECRET || "default_secret_key",
          { expiresIn: "1d" }
        );
        return res.json({ token, message: "Login num dispositivo confiavel!" });
      }
    }

    let isValidCode = false;

    // Priority 1: Verify email code (6 digits, expires in 60 seconds)
    if (code.length === 6 && user.twoFactorCode) {
      if (user.twoFactorCode === code && user.twoFactorCodeExpires > new Date()) {
        isValidCode = true;
        // Clear the code after successful verification
        user.twoFactorCode = null;
        user.twoFactorCodeExpires = null;
      }
    }

    // Priority 2: Verify TOTP code (if 2FA enabled and email code didn't work)
    if (!isValidCode && code.length === 6 && user.twoFactorEnabled && user.twoFactorSecret) {
      isValidCode = verifyTOTPCode(user.twoFactorSecret, code);
    }

    // Priority 3: Verify backup code (if 2FA enabled)
    if (!isValidCode && code.length === 8 && user.twoFactorEnabled) {
      const hashedCode = hashBackupCode(code);
      const backupCodeIndex = user.twoFactorBackupCodes.indexOf(hashedCode);

      if (backupCodeIndex !== -1) {
        // Remove used backup code
        user.twoFactorBackupCodes.splice(backupCodeIndex, 1);
        isValidCode = true;
      }
    }

    if (!isValidCode) {
      return res.status(400).json({ message: "Codigo invalido ou expirado." });
    }

    // Mark as trusted device if requested
    if (trustDevice && deviceId) {
      const deviceName = req.headers["user-agent"]?.substring(0, 50) || "Dispositivo Desconhecido";
      user.trustedDevices.push({
        deviceId,
        deviceName,
        createdAt: new Date(),
        lastUsed: new Date(),
      });
    }

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "default_secret_key",
      { expiresIn: "1d" }
    );

    res.json({ token, message: "Login efetuado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro na verificacao do codigo." });
  }
});

module.exports = router;
