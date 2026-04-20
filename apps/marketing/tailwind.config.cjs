const shared = require("../../tailwind.config.js");

module.exports = {
	...shared,
	content: ["./index.html", "./src/**/*.{ts,tsx}", "../../src/**/*.{ts,tsx}"],
};
