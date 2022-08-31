import { generate, parse, walk } from "css-tree";

class CssPrefixer {
	constructor(prefix) {
		this.prefix = prefix;
	}

	setFilePath(filePath) {
		this.filePath = filePath;
	}

	parse(str) {
		return parse(str, {
			// filename: this.filePath,
			positions: true
		})
	}

	process(cssString) {
		let ast = this.parse(cssString);

		let skipLevel = 0;

		walk(ast, {
			visit: "Selector",
			enter: (node, item, list) => {
				if(skipLevel === 0) {
					let first = node.children.first;
					if(first.type === "PseudoClassSelector" && first.name === "root") {
						// replace :root with prefix class
						node.children.shift();
					} else {
						node.children.prepend(list.createItem({
							type: "Combinator",
							name: " "
						}));
					}

					node.children.prepend(list.createItem({
						type: "ClassSelector",
						name: this.prefix
					}));
				}

				node.children.forEach((node, item, list) => {
					if(node.type === "PseudoClassSelector") {
						skipLevel++;
					}
				});
			},
			leave: (node, item, list) => {
				node.children.forEach((node) => {
					if(node.type === "PseudoClassSelector") {
						skipLevel--;
					}
				});
			}
		});

		return generate(ast, {
			sourceMap: false
		});
	}
}

export { CssPrefixer };
