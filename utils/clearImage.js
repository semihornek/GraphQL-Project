const fs = require("fs");
const path = require("path");

/**
 *
 * @param {string} filePath
 */
module.exports = clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => err && console.log(err));
};
