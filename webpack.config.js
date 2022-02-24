const path = require("path");

module.exports = {
	entry: "./src/index.js",
	mode: process.env.WEBPACK_MODE || "production",
	output: {
		filename: "index.js",
		path: path.resolve(__dirname, "./dist"),
	},
};
