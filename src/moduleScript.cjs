const { Module } = require("module");
const vm = require("vm");
const { RetrieveGlobals } = require("node-retrieve-globals");

const { ProxyData } = require("./proxyData.cjs");

let scriptCache = new Map();

class ModuleScript {

	static CJS_MODULE_EXPORTS = "module.exports = ";
	static ESM_EXPORT_DEFAULT = "export default ";
	static FUNCTION_REGEX = /^(?:async )?function\s?\S*\(/;

	static getGlobals() {
		let context = {
			require: function(target) {
				const path = require("path");
				// change relative paths to be relative to the root project dir
				// module paths are always / and not \\ on Windows, see https://github.com/nodejs/node/issues/6049#issuecomment-205778576
				if(target.startsWith("./") || target.startsWith("../")) {
					target = path.join(process.cwd(), target);
				}
				return require(target)
			}
		};

		return context;
	}

	static async evaluateScriptAndReturnAllGlobals(code, filePath, data) {
		let vm = new RetrieveGlobals(code, filePath);

		// returns promise
		return vm.getGlobalContext(data, {
			reuseGlobal: true, // re-use Node.js `global`, important if you want `console.log` to log to your console as expected.
			dynamicImport: true, // allows `import()`
		});
	}

	static async evaluateScript(content, data, errorString) {
		try {
			let proxy = new ProxyData();
			proxy.addGlobal(ModuleScript.getGlobals());
			proxy.addGlobal(global);

			let context = proxy.getData(data);

			// Performance improvement: we may be able to cache these at some point
			// careful here: re-using contexts generated here (e.g. via `evaluateAttributesArray`) was much slower!
			// vm.createContext(context, {
			// 	codeGeneration: {
			// 		strings: false
			// 	}
			// });

			let script = scriptCache.get(content);
			if(!script) {
				script = new vm.Script(content);
				scriptCache.set(content, script);
			}

			// The downstream code being evaluated here may return a promise!
			// let returnValue = script.runInContext(context);
			let returnValue = script.runInNewContext(context, {
				contextCodeGeneration: {
					strings: false
				}
			});
			return { returns: await returnValue, context };
		} catch(e) {
			// Issue #45: very defensive error message here. We only throw this error when an error is thrown during compilation.
			if(e.message === "Unexpected end of input" && content.match(/\bclass\b/) && !content.match(/\bclass\b\s*\{/)) {
				throw new Error(`\`class\` is a reserved word in JavaScript.${errorString ? ` ${errorString}` : ""} Change \`class\` to \`this.class\` instead!
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
