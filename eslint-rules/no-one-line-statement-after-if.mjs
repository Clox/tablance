export default {
    meta: {
        type: "layout",
        docs: {
            description: "Disallow `if (a) b++;` and `if (a) { b++; }`, but allow clean multi-line style."
        },
        messages: {
            oneLineBody: "Do not put the body of an if-statement on the same line.",
        },
        schema: []
    },

    create(context) {
        const source = context.getSourceCode();

        return {
            IfStatement(node) {
                const ifLine = node.loc.start.line;
                const bodyLine = node.consequent.loc.start.line;

                //
                // Case 1:
                //     if (a) b++;
                //
                if (!node.consequent.body && ifLine === bodyLine) {
                    return context.report({
                        node,
                        messageId: "oneLineBody"
                    });
                }

                //
                // Case 2:
                //     if (a) { b++; }
                //
                if (
                    node.consequent.type === "BlockStatement" &&
                    node.loc.start.line === node.loc.end.line
                ) {
                    return context.report({
                        node,
                        messageId: "oneLineBody"
                    });
                }

                //
                // Case 3:
                //     if (a)
                //     {
                //         b++;
                //     }
                //
                const textBetween = source.getText().split("\n")[ifLine - 1].trimEnd();
                if (
                    node.consequent.type === "BlockStatement" &&
                    textBetween.endsWith(")")
                ) {
                    const blockStartLine = node.consequent.loc.start.line;

                    // If `{` is NOT on the same line as the `if (...)`
                    if (blockStartLine !== ifLine) {
                        return context.report({
                            node,
                            messageId: "oneLineBody"
                        });
                    }
                }
            }
        };
    }
};
