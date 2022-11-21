const router = require("express").Router();
const { body } = require("express-validator");

const User = require("../models/user");
const authController = require("../controllers/auth");
const isAuth = require("../middleware/is-auth");

// PUT /auth/signup
router.put(
  "/signup",
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom(async (value, { req }) => {
        const userDoc = await User.findOne({ email: value });
        if (userDoc) return Promise.reject("e-mail address already exists");
      })
      .normalizeEmail(),

    body("password").trim().isLength({ min: 5 }),
    body("name").trim().not().isEmpty(),
  ],
  authController.signup
);

// POST /auth/login
router.post("/login", authController.login);

// GET /auth/status
router.get("/status", isAuth, authController.getUserStatus);

// PATCH /auth/updateUserStatus
router.patch("/updateUserStatus", isAuth, [body("status").trim().not().isEmpty()], authController.updateUserStatus);

module.exports = router;
