import lodashGet from "lodash.get";

class AttributeSerializer {
	static dedupeAttributes(attrs) {
		// Merge multiple class attributes into a single one
		let merged = {
			style: {
				value: [],
				splitDelimiter: ";",
				joinDelimiter: "; "
			},
			class: {
				value: [], // de-dupe individual classes
				splitDelimiter: " ",
				joinDelimiter: " ",
				deduplicate: true,
			}
		};

		for(let j = 0, k = attrs.length; j<k; j++) {
			let {name, value} = attrs[j];
			if(merged[name]) {
				// set skipped for 2nd+ dupes
				if(merged[name].value.length > 0 || value.trim().length === 0) {
					attrs[j].skipped = true;
				}
				for(let splitVal of value.split(merged[name].splitDelimiter)) {
					splitVal = splitVal.trim();
					if(splitVal) {
						merged[name].value.push(splitVal);
					}
				}
			}
		}

		let attrObject = {};
		for(let {skipped, name, value} of attrs) {
			if(skipped || name.startsWith("webc:")) {
				continue;
			}

			// Used merged values
			if(merged[name]) {
				let set = merged[name].value;
				if(merged[name].deduplicate) {
					set = Array.from(new Set(set));
				}
				attrObject[name] = set.join(merged[name].joinDelimiter);
			} else {
				attrObject[name] = value;
			}
		}

		return attrObject;
	}

	static getDataValue(data, selector) {
		return lodashGet(data, selector, "")
	}

	static normalizeAttribute(name, value, data) {
		if(name.startsWith(":")) {
			return {
				name: name.slice(1),
				value: AttributeSerializer.getDataValue(data, value),
			};
		}
		return {
			name,
			value
		};
	}

	static getString(attrs, data) {
		let str = [];
		let attrObject = attrs;
		if(Array.isArray(attrObject)) {
			attrObject = AttributeSerializer.dedupeAttributes(attrs);
		}
		for(let key in attrObject) {
			let {name, value} = AttributeSerializer.normalizeAttribute(key, attrObject[key], data);
			if(value === false) {
				continue;
			}

			str.push(` ${name}${value !== "" ? `="${value}"` : ""}`);
		}
		return str.join("");
	}
}

export { AttributeSerializer };