import { parse } from "parse5";

class AstCache {
	constructor() {
		this.ast = {};
	}

	get(contents) {
		if(!this.ast[contents]) {
			this.ast[contents] = parse(contents, {
				scriptingEnabled: true,
				sourceCodeLocationInfo: true,
			});
		}

		return this.ast[contents];
	}
}

export { AstCache };