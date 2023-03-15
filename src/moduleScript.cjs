const { Module } = require("module");
const vm = require("vm");
const { RetrieveGlobals } = require("node-retrieve-globals");

const { ProxyData } = require("./proxyData.cjs");
const { FasterVmContext } = require("./fasterVmContext.cjs");

let fasterVmContextGlobal = new FasterVmContext();

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
		let nodeGlobals = new RetrieveGlobals(code, filePath);

		// returns promise
		return nodeGlobals.getGlobalContext(data, {
			reuseGlobal: true, // re-use Node.js `global`, important if you want `console.log` to log to your console as expected.
			dynamicImport: true, // allows `import()`
		});
	}

	static async evaluateScriptInline(content, data, errorString, scriptContextKey) {
		// no difference yet
		return ModuleScript.evaluateScript(content, data, errorString, scriptContextKey);
	}

	static async evaluateScript(content, data, errorString, scriptContextKey) {
		try {
			let proxy = new ProxyData();
			proxy.addGlobal(ModuleScript.getGlobals());
			proxy.addGlobal(global);

			let contextData = proxy.getData(data);

			let script  = new vm.Script(content);

			// The downstream code being evaluated here may return a promise!
			let returnValue;
			if(scriptContextKey) {
				returnValue = fasterVmContextGlobal.executeScriptWithData(script, contextData, scriptContextKey);
			} else {
				returnValue = fasterVmContextGlobal.executeScriptExpensivelyInNewContext(script, contextData);
			}

			return { returns: await returnValue, context: contextData };
		} catch(e) {
			// Issue #45: very defensive error message here. We only throw this error when an error is thrown during compilation.
			if(e.message === "Unexpected end of input" && content.match(/\bclass\b/) && !content.match(/\bclass\b\s*\{/)) {
				throw new Error(`${errorString ? `${errorString} ` : ""}\`class\` is a reserved word in JavaScript. Change \`class\` to \`this.class\` instead!`);
			}
			throw new Error(`${errorString}
Original error message: ${e.message}`);
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
