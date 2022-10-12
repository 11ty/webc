import { Module } from "module";
import vm from "vm";
import { AstSerializer } from "./ast.js";

class ModuleScript {

	static CJS_MODULE_EXPORTS = "module.exports = ";
	static ESM_EXPORT_DEFAULT = "export default ";
	static FUNCTION_REGEX = /^(?:async )?function\s?\S*\(/;

	static getProxiedContext(context, propertyReferenceKey, propertyValue, fileName) {
		let proxiedContext = new Proxy(context, {
			get(target, propertyName) {
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}

				throw new Error(`'${propertyName}' not found when evaluating ${propertyReferenceKey}="${propertyValue}"${fileName ? ` in '${fileName}'` : ""}.
Check that '${propertyName}' is a helper, attribute name, property name, or is present in global data.`);
			}
		});

		return proxiedContext;
	}

	static async evaluateAttribute(name, content, data, options) {
		let context = ModuleScript.getProxiedContext(data, name, content, options.filePath);

		// alias for environment variables
		if(!("process" in context)) {
			context.process = {};
		}
		if(!("env" in context.process)) {
			context.process.env = process.env;
		}

		return vm.runInNewContext(content, context);
	}

	// TODO use the `vm` approach from `evaluateAttribute` above.
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