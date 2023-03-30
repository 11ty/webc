import { generate, parse, walk } from "css-tree";

class CssPrefixer {
	constructor(prefix) {
		if(!prefix) {
			throw new Error("No prefix was passed to the CSS prefixer!");
		}
		this.prefix = prefix;
	}

	static processWithoutTransformation(str) {
		let ast = parse(str, {
			positions: true
		});

		return generate(ast);
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
				let first = node.children.first;

				const shouldSkip =
					skipLevel > 0 ||
					// from/to in @keyframes
					(first.type === "TypeSelector" && first.name === "from") ||
					(first.type === "TypeSelector" && first.name === "to") ||
					// percentage selectors in @keyframes
					(first.type === "Percentage");

				if (shouldSkip) {
					// do nothing
				} else if (
					first.type === "PseudoClassSelector" &&
					(first.name === "host" || first.name === "host-context")
				) {
					// Transform :host and :host-context pseudo classes to
					// use the prefix class
					node.children.shift();

					const pseudoClassParamChildren = first.children ? first.children : null;

					if (first.name === "host") {
						// Replace :host with the prefix class
						if (pseudoClassParamChildren) {
							// Any param children of a :host() functional pseudo class should be moved up to
							// be directly after the prefix class
							// ie, :host(.foo) -> .prefix.foo
							node.children.prependList(
								// :host can only accept one param, so we can safely use the first child
								pseudoClassParamChildren.first.children
							);
						}
						node.children.prepend(
							list.createItem({
								type: "ClassSelector",
								name: this.prefix,
							})
						);
					} else if (first.name === "host-context") {
						// Replace :host-context with the prefix class and
						// place any param children appropriately before the prefix class
						node.children.prepend(
							list.createItem({
								type: "ClassSelector",
								name: this.prefix,
							})
						);

						if (pseudoClassParamChildren) {
							// Any param children of a :host-context() functional pseudo class should be moved up to
							// be parents before the prefix class
							// ie, :host-context(.foo) div -> .foo .prefix div
							node.children.prepend(
								list.createItem({
									type: "Combinator",
									name: " ",
								})
							);
							node.children.prependList(
								// :host-context can only accept one param, so we can safely use the first child
								pseudoClassParamChildren.first.children
							);
						}
					}
				} else {
					// Prepand the prefix class in front of all selectors
					// which don't include :host or :host-context
					node.children.prepend(
						list.createItem({
							type: "Combinator",
							name: " ",
						})
					);
					node.children.prepend(
						list.createItem({
							type: "ClassSelector",
							name: this.prefix,
						})
					);
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
