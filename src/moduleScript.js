import { Module } from "module";
import { AstSerializer } from "./ast.js";

class ModuleScript {

	static CJS_MODULE_EXPORTS = "module.exports = ";
	static ESM_EXPORT_DEFAULT = "export default ";
	static FUNCTION_REGEX = /^(?:async )?function\s?\S*\(/;

	static ASYNC_CONSTRUCTOR = (async function () {}).constructor;
	static SYNC_CONSTRUCTOR = (function () {}).constructor;

	static getProxiedContext(context, propertyReferenceKey, propertyValue) {
		let proxiedContext = new Proxy(context, {
			get(target, propertyName) {
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}
				// TODO show file name!!
				throw new Error(`'${propertyName}' not found when evaluating ${propertyReferenceKey}="${propertyValue}".
Check that '${propertyName}' is a helper, attribute name, property name, or is present in global data.`);
			}
		});

		return proxiedContext;
	}

	static addDestructuredWith(content, data = {}) {
		let keys = Object.keys(data).filter(attr => {
			// Don’t destructure numbers: {3, abc} throws an error
			return ""+Number(attr) !== attr;
		}).map(attr => {
			return attr.startsWith(AstSerializer.prefixes.dynamic) ? attr.slice(1) : attr;
		});
		return `return ({${keys.join(",")}}) => ${content};`;
	}

	static getAttributeFunction(constructor, nameDescription, content, data) {
		let fnContent = ModuleScript.addDestructuredWith(content, data);
		let fn = new constructor(fnContent);
		let context = ModuleScript.getProxiedContext(data, nameDescription, content);
		return fn.call(context);
	}

	static _evaluateAttribute(fn, name, content, data, options = {}) {
		try {
			return fn(data);
		} catch(e) {
			throw new Error(`Error compiling ${name} with content '${content}'${options.filePath ? ` in '${options.filePath}'` : ""}:\n${e}`);
		}
	}

	// Combine async/sync functions together
	static async evaluateAsyncAttribute(name, content, data, options) {
		let fn = await ModuleScript.getAttributeFunction(ModuleScript.ASYNC_CONSTRUCTOR, name, content, data);
		return ModuleScript._evaluateAttribute(fn, name, content, data, options);
	}

	static evaluateAttribute(name, content, data, options) {
		let fn = ModuleScript.getAttributeFunction(ModuleScript.SYNC_CONSTRUCTOR, name, content, data);
		return ModuleScript._evaluateAttribute(fn, name, content, data, options);
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