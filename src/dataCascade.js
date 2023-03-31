class DataCascade {
	constructor() {
		this.helpers = {};
		this.scopedHelpers = {};
	}

	setGlobalData(data) {
		this.globalData = data;
	}

	setHelper(name, callback, isScoped = false) {
		if(isScoped) {
			this.scopedHelpers[name] = callback;
		} else {
			this.helpers[name] = callback;
		}
	}

	// the renderAttributes function is one of these
	setWebCGlobals(globals) {
		this.webcGlobals = globals;
	}

	getHelpers() {
		// unscoped
		return this.helpers;
	}

	/*
	 * When `isTopLevelComponent` is not true (for inner components, not page-level) this scopes:
	 *   - global data under $data
	 *   - helpers under webc.*
	*
	 * This prevents global data leaking into inner components.
	 * Notably webc:setup always operates in top level component mode.
	 */
	getData(useGlobalDataAtTopLevel, attributes, ...additionalObjects) {
		let self = this;
		let objs = additionalObjects.reverse();
		let globals = useGlobalDataAtTopLevel ? this.globalData : undefined;

		let ret = Object.assign({}, globals, this.helpers, ...objs, attributes, {
			get $data() {
				return self.globalData;
			},
			webc: {
				helpers: this.scopedHelpers,
				attributes,
				...this.webcGlobals,
			}
		});

		return ret;
	}
}

export { DataCascade };