const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  try {
    const totalItems = await Post.countDocuments();

    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({ message: "Fetched posts successfully", posts, totalItems });
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
exports.createPost = async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed, entered data is incorrect");
    error.statusCode = 422;
    return next(error);
  }

  const { title, content } = req.body;
  // Get file from multer
  const image = req.file;
  if (!image) {
    const error = new Error("No image provided");
    error.statusCode = 422;
    return next(error);
  }

  try {
    // Create a post and save it
    const post = new Post({
      title,
      content,
      creator: req.userId,
      imageUrl: image.path,
    });
    await post.save();

    // Update the user
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();
    // Inform all users that a post is created
    io.getIO().emit("posts", {
      action: "create",
      post: {
        ...post._doc,
        creator: { _id: req.userId, name: user.name },
      },
    });

    // Inform the user that created this post
    res.status(201).json({
      message: "Post created successfully!",
      post,
      creator: { _id: user._id, name: user.name },
    });
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
exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error("Could not find post!");
      error.statusCode = 404;
      return next(error);
    }
    res.status(200).json({ message: "Post fetched!", post });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

/**
 *
 * @param {import("express").Request} req
 * @param {*} res
 * @param {import("express").NextFunction} next
 * @returns
 */
exports.updatePost = async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed, entered data is incorrect");
    error.statusCode = 422;
    return next(error);
  }

  const postId = req.params.postId;
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) imageUrl = req.file.path;

  if (!imageUrl) {
    const error = new Error("No image file picked!");
    error.statusCode = 422;
    return next(error);
  }

  try {
    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      const error = new Error("Could not find post!");
      error.statusCode = 404;
      return next(error);
    }

    // Check if the user is authorized to update the post
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403;
      return next(error);
    }

    // If a new image is uploaded delete the previous one
    if (post.imageUrl !== imageUrl) {
      clearImage(post.imageUrl);
    }

    (post.title = title), (post.imageUrl = imageUrl), (post.content = content);
    const result = await post.save();

    // Inform all users that the post is updated
    io.getIO().emit("posts", { action: "update", post: result });

    //Inform the user that updated this post
    res.status(200).json({ message: "Post updated", post: result });
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
 * @returns
 */
exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error("Couldn't find post");
      error.statusCode = 404;
      return next(error);
    }

    // Check if the user is authorized to delete the post
    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403;
      return next(error);
    }

    // Delete image locally
    clearImage(post.imageUrl);

    const result = await Post.findByIdAndRemove(postId);
    console.log(result);

    // Delete the relation btw the user and the post by deleting the post inside the posts array in the user object inside the DB.
    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    await user.save();

    // Inform all users that the post is deleted
    io.getIO().emit("posts", { action: "delete", post: postId });

    // Inform the user that deleted this post
    res.status(200).json({ message: "The post is deleted!" });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

/**
 *
 * @param {string} filePath
 */
const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => err && console.log(err));
};
