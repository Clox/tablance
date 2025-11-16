import js from "@eslint/js";
import globals from "globals";
import maxEffectiveLinesPerFunction from "./eslint-rules/max-effective-lines-per-function.mjs";
import noOneLineIf from "./eslint-rules/no-one-line-statement-after-if.mjs";



export default [
	js.configs.recommended,

	{
		files: ["**/*.js"],

		// Recognize browser globals like window, document, console, ResizeObserver, etc.
		languageOptions: {
			globals: {
				...globals.browser,
				Pikaday: "readonly",
			}
		},

		rules: {
			//
			// Warn if you accidentally leave console.log() in production code,
			// but allow console.warn() and console.error()
			//
			"no-console": ["warn", { allow: ["warn", "error"] }],
		
			//
			// Allow assignments inside conditions:
			//     if (x = compute()) ...
			// You prefer this pattern, so we disable the rule.
			//
			"no-cond-assign": "off",
		
			//
			// Your custom rule:
			// Counts "effective" lines inside a function (excluding braces, blank lines, comments),
			// *including nested functions*, and warns if it exceeds your set limit.
			// You can ignore specific function names using "ignoreNames".
			//
			"tablance/max-effective-lines-per-function": ["warn", {
				max: 50,
				ignoreNames: ["myMassiveObjectInitializer"]
			}],
			"tablance/no-one-line-if": "warn",

		
			//
			// Allow unused arguments ONLY if they start with "_" (e.g. `_event`, `_ignored`)
			// Useful for event handlers and placeholders without getting spammed.
			//
			"no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_"
				}
			],
		
			//
			// Enforce the "one true brace style" (1TBS):
			//     if (a) {
			//         ...
			//     }
			// NOT allowed:
			//     if (a)
			//     {
			//         ...
			//     }
			// Also disallows compressed blocks like: if (a) { b++; }
			//
			"brace-style": ["warn", "1tbs", { allowSingleLine: false }],
		
			//
			// Allow omitting curly braces ONLY when the block spans multiple lines, e.g.:
			//     if (a)
			//         b++;
			//
			// This forbids:
			//     if (a) b++;
			//
			// Combined with "brace-style", this enforces your exact preferred style.
			//
		},
		
		plugins: {
			"tablance": {
			  rules: {
				"max-effective-lines-per-function": maxEffectiveLinesPerFunction,
				"no-one-line-if": noOneLineIf,
			  }
			}
		  }
	}
];
