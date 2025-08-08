import { importFromString } from "import-module-string";

export async function wrapAndExecute(content, options) {
	let { filePath, context } = options || {};

	return importFromString(content, {
		filePath,
		implicitExports: false,
		compileAsFunction: true,
	}).then(mod => {
		let fn = mod.default;
		return fn(context);
	}).catch(e => {
		let errorString = `Evaluating JavaScript content filed:\n${content}`;

		// Issue #45: very defensive error message here. We only throw this error when an error is thrown during compilation.
		if(e.message.startsWith("Unexpected token ") && content.match(/\bclass\b/) && !content.match(/\bclass\b\s*\{/)) {
			throw new Error(`${errorString ? `${errorString} ` : ""}\`class\` is a reserved word in JavaScript. Change \`class\` to \`this.class\` instead!`, { cause: e });
		}

		throw new Error(`${errorString}\nOriginal error message: ${e.message}`, { cause: e });
	});
}