const jwt = require("jsonwebtoken");

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
module.exports = (req, res, next) => {
  // Get authorization header
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    req.isAuth = false;
    return next();
  }

  // Get the token
  const token = authHeader.split(" ")[1];
  try {
    // Decode the token
    const decodedToken = jwt.verify(token, "somesupersupersecret");
    if (!decodedToken) {
      req.isAuth = false;
      return next();
    }

    req.userId = decodedToken.userId;
    req.isAuth = true;
  } catch (error) {
    req.isAuth = false;
    return next();
  }

  next();
};
