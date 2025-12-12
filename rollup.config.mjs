import { readFileSync } from "fs";
import terser from "@rollup/plugin-terser";

const input = "src/tablance.js";
const external = ["pikaday"];
const globals = { pikaday: "Pikaday" };

function injectBuildMeta() {
	const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
	const buildTime = new Date().toISOString();

	return {
		name: "inject-build-meta",
		transform(code) {
			if (!code.includes("__TABLANCE_VERSION__") && !code.includes("__TABLANCE_BUILD__"))
				return null;
			return {
				code: code
					.replaceAll("__TABLANCE_VERSION__", JSON.stringify(version))
					.replaceAll("__TABLANCE_BUILD__", JSON.stringify(buildTime)),
				map: null,
			};
		},
	};
}

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
		injectBuildMeta(),
		terser({
			format: {
				comments: false,
			},
		}),
	],
};
