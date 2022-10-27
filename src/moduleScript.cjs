const { Module } = require("module");
const vm = require("vm");

class ModuleScript {

	static CJS_MODULE_EXPORTS = "module.exports = ";
	static ESM_EXPORT_DEFAULT = "export default ";
	static FUNCTION_REGEX = /^(?:async )?function\s?\S*\(/;

	static getProxiedContext(context) {
		let proxiedContext = new Proxy(context, {
			get(target, propertyName) {
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}

				return undefined;
			}
		});

		return proxiedContext;
	}

	static async evaluateAttribute(name, content, data) {
		try {
			let context = ModuleScript.getProxiedContext(data);
			let returnValue = vm.runInNewContext(content, context, {
				contextCodeGeneration: {
					strings: false
				}
			});
			return returnValue;
		} catch(e) {
			// Issue #45: very defensive error message here. We only throw this error when an error is thrown during compilation.
			if(e.message === "Unexpected end of input" && content.match(/\bclass\b/) && !content.match(/\bclass\b\s*\{/)) {
				throw new Error(`\`class\` is a reserved word in JavaScript. You may have tried to use it in a dynamic attribute: \`${name}="${content}"\`. Change \`class\` to \`this.class\` instead!
Original error message: ${e.message}`);
			}

			throw e;
		}
	}

	// TODO use the `vm` approach from `evaluateAttribute` above.
	static getModule(content, filePath) {
		let m = new Module();

		// This requires CJS (as the internal render function is technically CJS, too)
		m.paths = module.paths;

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

module.exports = { ModuleScript };
