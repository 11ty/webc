class AssetManager {
	constructor(depGraph, bucketsGraph) {
		this.graph = depGraph;
		this.bucketsGraph = bucketsGraph;
	}

	get orderedComponentList() {
		if(!this._ordered) {
			this._ordered = this.graph.overallOrder().reverse();
		}
		return this._ordered;
	}

	get orderedComponentListForAssets() {
		let foundIslands = false;
		let deps = this.graph.overallOrder().filter(entry => {
			if(!foundIslands && entry.endsWith("./node_modules/@11ty/is-land/is-land.webc")) {
				foundIslands = entry;
				return false;
			}
			return true;
		});
		if(foundIslands) {
			deps.unshift(foundIslands);
		}
		return deps;
	}

	getBundledAssets(assets) {
		let codeCheck = {};
		let buckets = {};

		for(let type in assets.buckets) {
			buckets[type] = {};

			for(let bucketName of assets.buckets[type]) {
				buckets[type][bucketName] = this.getOrderedAssetsSet(assets[type], bucketName);
			}

			for(let bucketName in buckets[type]) {
				// filter out duplicate code and elevate to the next upstream bucket
				for(let bucketCodeEntry of buckets[type][bucketName]) {
					if(!codeCheck[bucketCodeEntry]) {
						codeCheck[bucketCodeEntry] = bucketName;
						continue;
					}
					let deps = this.bucketsGraph.dependenciesOf(bucketName);
					let newBucketName = deps[deps.length - 1];

					// delete from previous bucket even if newBucketName is not defined
					// e.g. already in `async` and `default`, delete from `async` keep in `default`
					let previousBucketName = codeCheck[bucketCodeEntry];
					buckets[type][previousBucketName].delete(bucketCodeEntry);

					if(newBucketName) {
						// delete current bucket duplicate
						buckets[type][bucketName].delete(bucketCodeEntry);

						// move to next upstream inherited bucket
						if(!buckets[type][newBucketName]) {
							buckets[type][newBucketName] = new Set();
						}
						buckets[type][newBucketName].add(bucketCodeEntry);
					}
				}
			}

			// iterate over buckets to make arrays
			for(let bucketName in buckets[type]) {
				buckets[type][bucketName] = Array.from(buckets[type][bucketName]);

				// no empty buckets (except default)
				if(bucketName !== "default" && buckets[type][bucketName].length === 0) {
					delete buckets[type][bucketName];
				}
			}
		}

		let returnObject = { buckets };

		// default buckets for js and css are returned separately { css, js, buckets: {} }
		if(buckets?.css?.default) {
			returnObject.css = buckets.css.default;
			delete buckets.css.default;
		}
		if(buckets?.js?.default) {
			returnObject.js = buckets.js.default;
			delete buckets.js.default;
		}

		return returnObject;
	}

	getOrderedAssetsSet(assetObject, bucket = "default") {
		let assets = new Set();
		let components = this.orderedComponentListForAssets;

		for(let component of components) {
			if(assetObject[component] && assetObject[component][bucket]) {
				for(let entry of assetObject[component][bucket]) {
					assets.add(entry);
				}
			}
		}
		return assets;
	}
}

export { AssetManager };