const express = require("express");
const { APPLE_IPHONE_CATALOG, APPLE_IPHONE_CATALOG_META, findAppleIphoneByModel } = require("../data/appleIphoneCatalog");
const { getImeiValidationResult } = require("../utils/imei");

const router = express.Router();

router.get("/apple/iphones", (req, res) => {
  res.json({
    ...APPLE_IPHONE_CATALOG_META,
    devices: APPLE_IPHONE_CATALOG,
  });
});

router.post("/imei/validate", (req, res) => {
  const imeiResult = getImeiValidationResult(req.body?.imei);
  const selectedModel = String(req.body?.model || "").trim();
  const catalogModel = selectedModel ? findAppleIphoneByModel(selectedModel) : null;

  res.status(imeiResult.isValid ? 200 : 400).json({
    imei: String(req.body?.imei || ""),
    normalizedImei: imeiResult.normalizedImei,
    isValid: imeiResult.isValid,
    reason: imeiResult.reason,
    providerConfigured: false,
    validationMode: "local-format-check",
    selectedModel: selectedModel || null,
    selectedModelInCatalog: Boolean(catalogModel),
    note: imeiResult.isValid
      ? "A validacao atual confirma apenas formato e checksum. Consulta externa de existencia, blacklist ou proprietario nao esta configurada."
      : "Corrija o IMEI e tente novamente.",
  });
});

module.exports = router;
