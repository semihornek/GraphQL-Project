const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
exports.signup = async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed");
    error.statusCode = 422;
    error.data = errors.array();
    return next(error);
  }

  const { email, name, password } = req.body;
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    // Create a new user and save it into the db with the hashed password
    const user = new User({ email, name, password: hashedPassword });
    const result = await user.save();
    res.status(201).json({ message: "User created!", userId: result._id });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
};

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Find user with the given email
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error("A user with this email could not be found.");
      error.statusCode = 401;
      return next(error);
    }
    // Check if the entered password does match the password in the db
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Wrong password");
      error.statusCode = 401;
      return next(error);
    }
    // Generate JWT and send it to the client
    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString(),
      },
      "somesupersupersecret",
      { expiresIn: "1h" }
    );
    res.status(200).json({ token, userId: user._id.toString() });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
};

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found!");
      error.statusCode = 404;
      return next(error);
    }
    const status = user.status;
    res.status(200).json({ message: "Status is retrieved correctly!", status });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
exports.updateUserStatus = async (req, res, next) => {
  const status = req.body.status;
  try {
    // await User.findByIdAndUpdate(req.userId, { status });
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("User not found!");
      error.statusCode = 404;
      return next(error);
    }
    user.status = status;
    const updatedUser = await user.save();
    res.status(200).json({ message: "Status is updated correctly!", status: updatedUser.status });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};
