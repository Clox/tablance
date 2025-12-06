import terser from "@rollup/plugin-terser";

const input = "src/tablance.js";
const external = ["pikaday"];
const globals = { pikaday: "Pikaday" };

export default {
	input,
	external,
	output: [
		{
			file: "dist/tablance.esm.js",
			format: "esm",
			sourcemap: true,
		},
		{
			file: "dist/tablance.umd.js",
			format: "iife",
			name: "Tablance",
			globals,
			sourcemap: true,
		},
	],
	plugins: [
		terser({
			format: {
				comments: false,
			},
		}),
	],
};
