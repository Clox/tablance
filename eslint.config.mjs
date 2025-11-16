import js from "@eslint/js";

export default [
	js.configs.recommended,

	{
		files: ["**/*.js"],

		rules: {
			"max-lines-per-function": ["warn", {
				max: 50,
				skipBlankLines: true,
				skipComments: true
			}]
		}
	}
];
