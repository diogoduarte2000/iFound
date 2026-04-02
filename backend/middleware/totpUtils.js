const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

// Generate TOTP secret and backup codes
const generateTOTPSecret = (email) => {
  const secret = speakeasy.generateSecret({
    name: `iFound Security (${email})`,
    issuer: "iFound",
    length: 32,
  });

  return {
    secret: secret.base32,
    qrCodeUrl: secret.otpauth_url,
  };
};

// Generate QR Code as data URL
const generateQRCode = async (otpauthUrl) => {
  try {
    const qrCode = await QRCode.toDataURL(otpauthUrl);
    return qrCode;
  } catch (error) {
    throw new Error("Failed to generate QR code");
  }
};

// Verify TOTP code
const verifyTOTPCode = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: "base32",
    token: token,
    window: 1, // Allow 1 step forward/backward (30s each)
  });
};

// Generate backup codes (8 codes, 8 characters each)
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

// Hash backup code for storage (simple hash for security)
const hashBackupCode = (code) => {
  return require("crypto")
    .createHash("sha256")
    .update(code)
    .digest("hex");
};

// Verify backup code
const verifyBackupCode = (providedCode, hashedCode) => {
  const hash = require("crypto")
    .createHash("sha256")
    .update(providedCode)
    .digest("hex");
  return hash === hashedCode;
};

module.exports = {
  generateTOTPSecret,
  generateQRCode,
  verifyTOTPCode,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
};
