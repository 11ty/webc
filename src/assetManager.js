class AssetManager {
	constructor(depGraph) {
		this.graph = depGraph;
	}

	get orderedComponentList() {
		if(!this._ordered) {
			this._ordered = this.graph.overallOrder().reverse();
		}
		return this._ordered;
	}

	getOrderedAssets(assetObject, bucket = "default") {
		let assets = new Set();
		for(let component of this.orderedComponentList) {
			if(assetObject[component] && assetObject[component][bucket]) {
				for(let entry of assetObject[component][bucket]) {
					assets.add(entry);
				}
			}
		}
		return Array.from(assets);
	}
}

export { AssetManager };