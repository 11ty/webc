const vm = require("vm");

class ContextInstance {
	constructor() {
		this.data = {};
	}

	getNewContext() {
		let self = this;
		// Top level context proxy (globals in JavaScript)
		let proxy = new Proxy({}, {
			has(target, key) {
				return key in target;
			},
			get(target, propertyName) {
				if(Reflect.has(self.data, propertyName)) {
					return self.data[propertyName];
				}
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}
				if(Reflect.has(global, propertyName)) {
					return Reflect.get(global, propertyName);
				}
				return undefined;
			}
		});

		return vm.createContext(proxy)
	}

	getContext() {
		if(!this.context) {
			this.context = this.getNewContext();
		}
		return this.context;
	}

	setData(data) {
		this.data = data;
	}
}

class FasterVmContext {
	constructor() {
		this.cache = {};
	}

	getContextInstance(cacheKey) {
		if(!this.cache[cacheKey]) {
			this.cache[cacheKey] = new ContextInstance();
		}
		return this.cache[cacheKey];
	}

	executeScriptWithData(script, newData, cacheKey = "global") {
		let contextInstance = this.getContextInstance(cacheKey);
		contextInstance.setData(newData);

		return script.runInContext(contextInstance.getContext(), {
			contextCodeGeneration: {
				strings: false
			}
		});
	}

	executeScriptExpensivelyInNewContext(script, data) {
		let context = vm.createContext(data);
		return script.runInContext(context, {
			contextCodeGeneration: {
				strings: false
			}
		})
	}
}

module.exports = { FasterVmContext };