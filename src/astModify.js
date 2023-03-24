// Take extreme care when using these utilities, they mutate the Live AST

class AstModify {
	static addAttribute(node, name, value) {
		node.attrs.push({ name, value });
	}

	// Not in use
	// static removeAttribute(node, name) {
	// 	let index = node.attrs.findIndex(attr => attr.name === name);
	// 	if(index !== -1) {
	// 		node.attrs.splice(index, 1);
	// 	}
	// }
}

export { AstModify };