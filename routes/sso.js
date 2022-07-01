const express = require("express");

const router = express.Router();
const AutoController = require("../controllers/authController");

router
  .route("/ssoLogin")
  .get(AutoController.ssoLogin)
  .post(AutoController.doLogin);

module.exports = router;
