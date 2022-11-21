require("dotenv").config();

const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const multer = require("multer");
const { graphqlHTTP } = require("express-graphql");

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const auth = require("./middleware/auth");
const clearImage = require("./utils/clearImage");

const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const MONGODB_URI = `mongodb+srv://${DB_USER}@cluster0.gkrbr.mongodb.net/${DB_NAME}`;

const app = express();

// use body parser to parse the incoming data
// app.use(bodyParser.urlencoded); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json

/** Multer Setup **/

// use multer to parse the incoming files -- in our case it is a single image file
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "images"),
  filename: (req, file, cb) =>
    cb(null, new Date().toISOString().replace(/\-/g, "").replace(/\:/g, "") + "-" + file.originalname),
});

const fileFilter = (req, file, cb) => {
  const fileTypes = ["image/png", "image/jpg", "image/jpeg"];
  if (fileTypes.includes(file.mimetype)) cb(null, true);
  else cb(null, false);
};

app.use(multer({ storage, fileFilter }).single("image"));

// Static File Handling - Images
app.use("/images", express.static(path.join(__dirname, "images")));

// Cors Setup
app.use(
  /**
   *
   * @param {import("express").Request} req
   * @param {import("express").Response} res
   * @param {import("express").NextFunction} next
   */
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  }
);

// Authentication Middleware
app.use(auth);

// Handle Image Uploading
// /post-image => PUT
app.put("/post-image", (req, res, next) => {
  // Check if the user is authenticated
  if (!req.isAuth) {
    throw new Error("Not authenticated!");
  }

  // Get the file from multer
  if (!req.file) {
    return res.status(200).json({ message: "No file provided!" });
  }
  // Clear the old image
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  return res.status(201).json({ message: "File stored.", filePath: req.file.path });
});

// GraphQL Middleware
app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(error) {
      if (!error.originalError) {
        return error;
      }
      const data = error.originalError.data;
      const message = error.message || "An error occured!";
      const statusCode = error.originalError.statusCode || 500;
      return { message, statusCode, data };
    },
  })
);

// Error Handling Middleware
app.use(
  /**
   *
   * @param {import("express").ErrorRequestHandler} error
   * @param {*} req
   * @param {import("express").Response} res
   * @param {*} next
   */
  (error, req, res, next) => {
    console.log(error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message, data: error.data });
  }
);

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    app.listen(8080, () => console.log("Server started listening on port: " + 8080));
  } catch (error) {
    console.log(error);
  }
})();
