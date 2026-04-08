const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
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

// Initialize SMTP transporter
const { isSmtpConfigured } = require("../db");
const smtpTransporter = isSmtpConfigured()
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;
const FROM_EMAIL = process.env.MAIL_FROM || "noreply@ifound.pt";

const generate2FACode = () => Math.floor(100000 + Math.random() * 900000).toString();

const buildSecurityCodeEmail = ({ title, intro, code, expiry, footnote }) => {
  const text = [
    "Ifound",
    "",
    title,
    "",
    intro,
    "",
    `Codigo: ${code}`,
    expiry,
    "",
    footnote,
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="pt">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #eef2f7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eef2f7; margin: 0; padding: 32px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
                <tr>
                  <td align="center" style="padding: 0 0 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="width: 48px; height: 48px; border-radius: 14px; background-color: #111827; font-family: Arial, sans-serif; font-size: 22px; font-weight: 700; color: #ffffff;">
                          i
                        </td>
                        <td style="padding-left: 12px; font-family: Arial, sans-serif; font-size: 24px; font-weight: 700; color: #111827;">
                          Ifound
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #dbe3ee; border-radius: 28px;">
                      <tr>
                        <td style="padding: 32px 32px 20px;">
                          <div style="display: inline-block; padding: 6px 10px; border-radius: 999px; background-color: #eef2ff; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #3730a3;">
                            Verificacao de seguranca
                          </div>
                          <h1 style="margin: 16px 0 12px; font-family: Arial, sans-serif; font-size: 30px; line-height: 1.2; color: #111827;">
                            ${title}
                          </h1>
                          <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.75; color: #4b5563;">
                            ${intro}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 32px 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; border-radius: 24px;">
                            <tr>
                              <td align="center" style="padding: 18px 16px 8px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #94a3b8;">
                                Codigo de acesso
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding: 0 16px 18px; font-family: Arial, sans-serif; font-size: 42px; line-height: 1; font-weight: 700; letter-spacing: 0.34em; color: #ffffff;">
                                ${code}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 32px 32px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 0 0 16px; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.7; color: #374151;">
                                ${expiry}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 0 0 20px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.75; color: #6b7280;">
                                ${footnote}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 18px 20px; border: 1px solid #e5e7eb; border-radius: 18px; background-color: #f9fafb; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #6b7280;">
                                Por seguranca, nunca partilhe este codigo. A equipa Ifound nunca o pedira por email, telefone ou mensagem.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 16px 20px 0; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.7; color: #94a3b8;">
                    Enviado automaticamente por Ifound. Nao responda a este email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { html, text };
};

const send2FAEmail = async (email, code) => {
  if (!smtpTransporter) {
    console.error("Erro: SMTP nao configurado. Adiciona SMTP_HOST, SMTP_USER, SMTP_PASS.");
    throw new Error("Email service not configured");
  }

  const emailContent = buildSecurityCodeEmail({
    title: "Confirme o seu acesso",
    intro: "Recebemos um pedido de autenticacao para a sua conta Ifound. Use o codigo abaixo para concluir o acesso em seguranca.",
    code,
    expiry: "Este codigo expira em 60 segundos.",
    footnote: "Se nao reconhece este pedido, ignore este email. O acesso nao sera concluido sem a introducao deste codigo.",
  });

  await smtpTransporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: "Seu codigo de acesso Ifound",
    text: emailContent.text,
    html: emailContent.html,
  });

  return { deliveryMode: "email" };
};

const sendPasswordResetEmail = async (email, code) => {
  if (!smtpTransporter) {
    console.error("Erro: SMTP nao configurado. Adiciona SMTP_HOST, SMTP_USER, SMTP_PASS.");
    throw new Error("Email service not configured");
  }

  const emailContent = buildSecurityCodeEmail({
    title: "Recupere a sua palavra-passe",
    intro: "Recebemos um pedido para redefinir a palavra-passe da sua conta Ifound. Use o codigo abaixo para continuar.",
    code,
    expiry: "Este codigo expira em 15 minutos.",
    footnote: "Se nao pediu esta recuperacao, ignore este email e mantenha a sua conta sob observacao.",
  });

  await smtpTransporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: "Recuperacao de Palavra-passe Ifound",
    text: emailContent.text,
    html: emailContent.html,
  });

  return { deliveryMode: "email" };
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
      message: "Codigo de recuperacao enviado para o seu email."
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
