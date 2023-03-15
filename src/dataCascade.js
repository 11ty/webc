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

	getData(attributes, ...additionalObjects) {
		// TODO improve perf by re-using a merged object of the global stuff
		let objs = additionalObjects.reverse();
		return Object.assign({}, this.globalData, this.helpers, ...objs, attributes, {
			webc: {
				attributes,
				...this.webcGlobals,
			}
		});
	}
}

export { DataCascade };