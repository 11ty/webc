import { Module } from "module";

class ModuleScript {

	static CJS_MODULE_EXPORTS = "module.exports = ";
	static ESM_EXPORT_DEFAULT = "export default ";
	static FUNCTION_REGEX = /^(?:async )?function\s?\S*\(/;

	static evaluateAsyncAttribute(content) {
		const AsyncFunction = (async function () {}).constructor;
		return new AsyncFunction(`return ${content};`);
	}

	static evaluateAttribute(content) {
		const Function = (function () {}).constructor;
		return new Function(`return ${content};`);
	}

	static getModule(content, filePath) {
		let m = new Module();
		// m.paths = module.paths;
		let trimmed = content.trim();

		// replace `export default` with `module.exports`
		if(trimmed.startsWith(ModuleScript.ESM_EXPORT_DEFAULT)) {
			trimmed = `module.exports = ${trimmed.slice(ModuleScript.ESM_EXPORT_DEFAULT.length)}`
		}

		// Implied CJS
		if(!trimmed.startsWith(ModuleScript.CJS_MODULE_EXPORTS)) {
			if(trimmed.match(ModuleScript.FUNCTION_REGEX) != null) {
				trimmed = ModuleScript.CJS_MODULE_EXPORTS + trimmed;
			}
		}

		try {
			m._compile(trimmed, filePath);
			return m.exports;
		} catch(e) {
			throw new Error(`Error parsing WebC scripted render function (${filePath}): ${e.toString()}\n` + content)
		}
	}
}

export { ModuleScript };