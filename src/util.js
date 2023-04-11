import util from "util";
import { AstQuery } from "./astQuery.js";

class Util {
	static inspect(arg) {
		return util.inspect(arg, false, 0, true);
	}

	static getNodeToStringRaw(node, tagName) {
		let attrString = [];
		for(let {name, value} of node.attrs) {
			attrString.push(`${name}="${value}"`);
		}
		return `<${tagName}${attrString.length ? " " : ""}${attrString.join(" ")}>${node.childNodes?.length ? "[…]" : ""}`;
	}

	static logNodeOptions(options) {
		console.log( "> is slottable content:", options.isSlottableContent );
		console.log( "> authored in:", options.authoredInComponent );
		console.log( "closest parent:", options.closestParentComponent );
	}

	static logNode(node) {
		let content = [];
		let tagName = AstQuery.getTagName(node);
		if(tagName) {
			// TODO only skip for `component` rendering mode (not `page`)
			if(tagName === "body" || tagName === "html" || tagName === "head") {
				// skip
			} else {
				content.push("Node: " + Util.inspect(Util.getNodeToStringRaw(node, tagName)));
				// content.push(AstQuery.inspect(arg));
			}
		} else if(node.nodeName === "#text") {
			content.push("Text node: " + Util.inspect(node.value))
		}
		console.log(...content);
	}
}

export { Util };