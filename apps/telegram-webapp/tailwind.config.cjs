const shared = require("../../tailwind.config.cjs");

module.exports = {
	...shared,
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
};
