class Looping {
	static parseKey(content, type) {
		content = content.trim();
		// starting and ending parens are optional
		if(content.startsWith("(") && content.endsWith(")")) {
			content = content.slice(1, -1);
		}

		let [first, second, third] = content.split(",").map(entry => entry.trim());

		if(type === "Object") {
			return {
				key: first,
				value: second,
				index: third,
			}
		}

		return {
			value: first,
			index: second
		};
	}

	static parse(loopAttr) {
		let delimiters = [
			{
				value: " in ",
				type: "Object",
				wrap: (content) => {
					content = content.trim();
					if(content.startsWith("{") && content.endsWith("}")) {
						return `(${content})`;
					}
					return content;
				}
			},
			{
				value: " of ",
				type: "Array",
			}
		];

		for(let delimiter of delimiters) {
			if(loopAttr.includes(delimiter.value)) {
				let [keysValue, content] = loopAttr.split(delimiter.value);
				return {
					keys: Looping.parseKey(keysValue, delimiter.type),
					type: delimiter.type,
					content: delimiter.wrap ? delimiter.wrap(content) : content,
				}
			}
		}

		throw new Error(`Invalid ${AstSerializer.attrs.LOOP} attribute value: ${loopAttr}`);
	}
}

export { Looping };