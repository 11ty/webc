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

	shouldSkipPseudoClass(name) {
		return {
			"host-context": true,
		}[name];
	}

	process(cssString) {
		let ast = this.parse(cssString);

		let skipLevel = 0;

		walk(ast, {
			visit: "Selector",
			enter: (node, item, list) => {
				let first = node.children.first;
				if(first.type === "PseudoClassSelector" && this.shouldSkipPseudoClass(first.name)) {
					// Skip processing some pseudo classes
				} else {
					if(skipLevel > 0 || first.type === "TypeSelector" && (first.name === "from" || first.name === "to")) {
						// do nothing
					} else {
						if(first.type === "PseudoClassSelector" && first.name === "host") {
							// replace :host with prefix class
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
