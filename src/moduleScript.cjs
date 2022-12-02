const { Module } = require("module");
const vm = require("vm");

class ModuleScript {

	static CJS_MODULE_EXPORTS = "module.exports = ";
	static ESM_EXPORT_DEFAULT = "export default ";
	static FUNCTION_REGEX = /^(?:async )?function\s?\S*\(/;

	static getProxiedContext(context, globals) {
		let proxiedContext = new Proxy(context, {
			get(target, propertyName) {
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}

				if(globals) {
					if(propertyName in globals) {
						return globals[propertyName];
					}
				}

				return undefined;
			}
		});

		return proxiedContext;
	}

	static async evaluateScript(name, content, data, options = {}) {
		options = Object.assign({
			injectGlobals: false
		}, options);

		try {
			let globals;

			if(options.injectGlobals) {
				// Add globals https://nodejs.org/api/globals.html#global
				globals = {
					console,
					Promise,
					...global,
				}

				globals.require = function(target) {
					const path = require("path");

					// change relative paths to be relative to the root project dir
					// module paths are always / and not \\ on Windows, see https://github.com/nodejs/node/issues/6049#issuecomment-205778576
					if(target.startsWith("./") || target.startsWith("../")) {
						target = path.join(process.cwd(), target);
					}

					return require(target)
				};

				// TODO wrap in function if the `js` content includes a `return` statement
			}

			let context = ModuleScript.getProxiedContext(data, globals);
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
