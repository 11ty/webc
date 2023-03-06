class DataCascade {
	constructor() {
		this.helpers = {};
	}

	setGlobalData(data) {
		this.globalData = data;
	}

	setHelper(name, callback) {
		this.helpers[name] = callback;
	}

	// the renderAttributes function is one of these
	setWebCGlobals(globals) {
		this.webcGlobals = globals;
	}

	getHelpers() {
		return this.helpers;
	}

	getData(attributes, hostAttributes, setupScript) {
		// TODO improve perf by re-using a merged object of the global stuff
		return Object.assign({}, this.globalData, this.helpers, setupScript, hostAttributes, attributes, {
			webc: {
				attributes,
				...this.webcGlobals,
			}
		});
	}
}

export { DataCascade };