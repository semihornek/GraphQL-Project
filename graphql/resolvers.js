const bcyrpt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");
const post = require("../models/post");
const clearImage = require("../utils/clearImage");

module.exports = {
  /**
   *
   * @param {import("graphql").GraphQLArgs} args
   * @param {*} req
   */
  createUser: async (args, req) => {
    const { email, name, password } = args.userInput;

    // Validation
    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: "e-mail is invalid." });
    }
    if (validator.isEmpty(password) || !validator.isLength(password, { min: 5 })) {
      errors.push({ message: "Password is too short" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    // Check if the user already exists in the users collection
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error("User exists already!");
      throw error;
    }

    // Hash the password
    const hashedPassword = await bcyrpt.hash(password, 12);
    // Create a new user and save it into the db with the hashed password
    const user = new User({
      email,
      name,
      password: hashedPassword,
    });
    const createdUser = await user.save();

    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },

  login: async ({ email, password }) => {
    // Validation
    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: "e-mail is invalid!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findOne({ email });
    // Check if the user exists in the users collection
    if (!user) {
      const error = new Error(`User with the ${email} email adress not found!`);
      error.statusCode = 401;
      throw error;
    }
    // Check the password
    const isEqual = await bcyrpt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Password is incorrect.");
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      "somesupersupersecret",
      { expiresIn: "1h" }
    );

    return { token, userId: user._id.toString() };
  },

  /**
   *
   * @param {import("graphql").GraphQLArgs} args
   * @param {*} req
   */
  createPost: async (args, req) => {
    // Check if the user is authenticated
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.statusCode = 401;
      throw error;
    }

    const { title, imageUrl, content } = args.postInput;

    // Validation
    const errors = [];
    if (!validator.isLength(title, { min: 5 })) {
      errors.push({ message: "Title is too short!" });
    }
    if (!validator.isLength(content, { min: 5 })) {
      errors.push({ message: "Content is too short!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid user!");
      error.statusCode = 401;
      throw error;
    }

    // Create a post and save it
    const post = new Post({
      title,
      content,
      creator: user,
      imageUrl,
    });
    const createdPost = await post.save();

    // Update the user
    user.posts.push(post);
    await user.save();

    return {
      ...createdPost._doc,
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },

  getPosts: async ({ page }, req) => {
    // Check if the user is authenticated
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.statusCode = 401;
      throw error;
    }

    const currentPage = page || 1;
    const perPage = 2;

    const totalPosts = await Post.countDocuments();
    // if (totalPosts === 0) {
    //   const error = new Error("There are no posts!");
    //   error.statusCode = 500;
    //   throw error;
    // }

    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // if (posts.length === 0) {
    //   const error = new Error("There are no posts!");
    //   error.statusCode = 500;
    //   throw error;
    // }

    return {
      posts: posts.map((post) => ({
        ...post._doc,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      })),
      totalPosts,
    };
  },

  getPost: async ({ postId }, req) => {
    // Check if the user is authenticated
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.statusCode = 401;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      const error = new Error("Could not find post!");
      error.statusCode = 404;
      throw error;
    }
    return { ...post._doc, createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString() };
  },

  updatePost: async ({ id, postInput }, req) => {
    // Check if the user is authenticated
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.statusCode = 401;
      throw error;
    }
    // Find the post
    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("Could not find post!");
      error.statusCode = 404;
      throw error;
    }
    // Check if the user is authorized to update the post
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403;
      throw error;
    }

    const { title, imageUrl, content } = postInput;

    // Validation
    const errors = [];
    if (!validator.isLength(title, { min: 5 })) {
      errors.push({ message: "Title is too short!" });
    }
    if (!validator.isLength(content, { min: 5 })) {
      errors.push({ message: "Content is too short!" });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    // Update the post
    post.title = title;
    post.content = content;
    if (imageUrl !== "undefined") {
      post.imageUrl = imageUrl;
    }
    const updatedPost = await post.save();

    return {
      ...updatedPost._doc,
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },

  deletePost: async ({ id }, req) => {
    // Check if the user is authenticated
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.statusCode = 401;
      throw error;
    }
    // Find the post
    const post = await Post.findById(id);
    if (!post) {
      const error = new Error("Could not find post!");
      error.statusCode = 404;
      throw error;
    }
    // Check if the user is authorized to delete the post
    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not authorized!");
      error.statusCode = 403;
      throw error;
    }

    // Find the user
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid user!");
      error.statusCode = 401;
      throw error;
    }
    // Delete image locally
    clearImage(post.imageUrl);

    // Delete the post
    await Post.findByIdAndRemove(id);

    // Delete the relation btw the user and the post by deleting the post inside the posts array in the user object inside the DB.
    user.posts.pull(id);
    await user.save();

    return true;
  },

  getUser: async ({}, req) => {
    // Check if the user is authenticated
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.statusCode = 401;
      throw error;
    }
    // Find the user
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Could not find user!");
      error.statusCode = 404;
      throw error;
    }
    return { ...user._doc };
  },

  updateUserStatus: async ({ status }, req) => {
    // Check if the user is authenticated
    if (!req.isAuth) {
      const error = new Error("Not authenticated!");
      error.statusCode = 401;
      throw error;
    }
    // Find the user
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Could not find user!");
      error.statusCode = 404;
      throw error;
    }
    // Update the user status
    user.status = status;
    await user.save();

    return user.status;
  },
};
