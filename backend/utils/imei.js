const normalizeImei = (value) => String(value || "").replace(/\D/g, "");

const passesLuhnChecksum = (digits) => {
  let sum = 0;

  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);

    if (Number.isNaN(digit)) {
      return false;
    }

    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  return sum % 10 === 0;
};

const getImeiValidationResult = (rawImei) => {
  const normalizedImei = normalizeImei(rawImei);

  if (!normalizedImei) {
    return {
      normalizedImei,
      isValid: false,
      reason: "Introduza um IMEI para validar.",
    };
  }

  if (normalizedImei.length !== 15) {
    return {
      normalizedImei,
      isValid: false,
      reason: "O IMEI deve ter exatamente 15 digitos.",
    };
  }

  if (!passesLuhnChecksum(normalizedImei)) {
    return {
      normalizedImei,
      isValid: false,
      reason: "O IMEI nao passou a validacao de checksum.",
    };
  }

  return {
    normalizedImei,
    isValid: true,
    reason: "IMEI valido no formato e checksum.",
  };
};

module.exports = {
  normalizeImei,
  getImeiValidationResult,
};
