const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    nif: { type: String, required: true, unique: true }, // Tax ID for Portugal
    
    // 2FA Fields (TOTP-based with Google Authenticator)
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String }, // BASE32 secret for TOTP
    twoFactorBackupCodes: [{ type: String }], // One-time backup codes
    twoFactorSetupPending: { type: Boolean, default: false }, // Flag for incomplete setup
    
    // Temporary 2FA Code (sent via email, expires in 60 seconds)
    twoFactorCode: { type: String },
    twoFactorCodeExpires: { type: Date },
    
    // Trusted Devices (skip 2FA on trusted devices)
    trustedDevices: [{
      deviceId: { type: String },
      deviceName: { type: String },
      createdAt: { type: Date, default: Date.now },
      lastUsed: { type: Date, default: Date.now }
    }],

    // Password Reset
    resetPasswordSecret: { type: String },
    resetPasswordExpires: { type: Date },

    // Legal / GDPR Consent
    rgpdConsent: { type: Boolean, required: true },
    consentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
