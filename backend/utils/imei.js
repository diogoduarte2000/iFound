const normalizeImei = (value) => String(value || "").trim();

const getImeiValidationResult = (rawImei) => {
  const normalizedImei = normalizeImei(rawImei);

  if (!normalizedImei) {
    return {
      normalizedImei,
      isValid: false,
      reason: "Introduza um IMEI para validar.",
    };
  }

  if (!/^\d+$/.test(normalizedImei)) {
    return {
      normalizedImei,
      isValid: false,
      reason: "O IMEI deve conter apenas caracteres numericos.",
    };
  }

  if (normalizedImei.length !== 15) {
    return {
      normalizedImei,
      isValid: false,
      reason: "O IMEI deve ter exatamente 15 digitos numericos.",
    };
  }

  return {
    normalizedImei,
    isValid: true,
    reason: "IMEI valido com 15 digitos numericos.",
  };
};

module.exports = {
  normalizeImei,
  getImeiValidationResult,
};
