class ProxyData {
	constructor() {
		this.preTargets = [];
		this.postTargets = [];
	}

	addTarget(target) {
		if(target) {
			this.preTargets.unshift(target);
		}
	}

	addGlobal(target) {
		if(target) {
			this.postTargets.push(target);
		}
	}

	getData(target) {
		let self = this;
		return new Proxy(target || {}, {
			has(target, key) {
				return key in target;
			},
			get(target, propertyName) {
				for(let t of self.preTargets) {
					if(t && Reflect.has(t, propertyName)) {
						return t[propertyName];
					}
				}
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}
				for(let t of self.postTargets) {
					if(t && Reflect.has(t, propertyName)) {
						return t[propertyName];
					}
				}
				return undefined;
			}
		});
	}
}

module.exports = { ProxyData };