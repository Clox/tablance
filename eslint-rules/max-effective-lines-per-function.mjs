export default {
    meta: {
        type: "suggestion",
        docs: {
            description: "Limit number of meaningful lines inside any function"
        },
        schema: [
            {
                type: "object",
                properties: {
                    max: { type: "number" },
                    ignoreNames: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                additionalProperties: false
            }
        ],
        messages: {
            tooMany: "Function has {{count}} effective lines (limit: {{max}})."
        }
    },

    create(context) {
        const sourceCode = context.getSourceCode();
        const options = context.options[0] || {};
        const max = options.max ?? 50;
        const ignoreNames = options.ignoreNames ?? [];

        function shouldIgnore(node) {
            const name = node.id?.name || node.key?.name || node.key?.value;
            return name && ignoreNames.includes(name);
        }

        function check(node) {
            if (!node.loc) return;
            if (shouldIgnore(node)) return;

            const lines = sourceCode
                .getLines()
                .slice(node.loc.start.line - 1, node.loc.end.line);

            let effective = 0;
            for (const line of lines) {
                const trimmed = line.trim();

                if (!trimmed) continue;                          // blank line
                if (trimmed.startsWith("//")) continue;          // single-line comment
                if (trimmed.startsWith("/*")) continue;          // block comment
                if (/^[{};]+$/.test(trimmed)) continue;          // braces-only or punctuation

                effective++;
            }

            if (effective > max) {
                context.report({
                    node,
                    messageId: "tooMany",
                    data: { count: effective, max }
                });
            }
        }

		return {

			// Free-standing functions
			FunctionDeclaration: check,
		
			// Class & object methods
			MethodDefinition(node) {
				if (node.value) check(node.value);
			},
		
			Property(node) {
				// Object literal methods: foo() { ... }
				if (node.value && (node.value.type === "FunctionExpression" || node.value.type === "ArrowFunctionExpression")) {
					check(node.value);
				}
			},
		
			// Arrow functions and function expressions NOT inside methods
			FunctionExpression(node) {
				if (
					node.parent.type !== "MethodDefinition" &&
					node.parent.type !== "Property"
				) {
					check(node);
				}
			},
		
			ArrowFunctionExpression(node) {
				if (
					node.parent.type !== "MethodDefinition" &&
					node.parent.type !== "Property"
				) {
					check(node);
				}
			}
		};
		
    }
};
