import lodashGet from "lodash.get";
import { AstSerializer } from "./ast.js";

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

	static getDataValue(selector, data, globalData) {
		let dataValue = lodashGet(data, selector, "");
		if(dataValue === "") {
			return lodashGet(globalData, selector, "");
		}
		return dataValue;
	}

	static normalizeAttribute(name, value, data, globalData) {
		if(name.startsWith(AstSerializer.prefixes.lookup)) {
			return {
				name: name.slice(1),
				value: AttributeSerializer.getDataValue(value, data, globalData),
			};
		}
		return {
			name,
			value
		};
	}

	// Remove props prefixes
	static removePropsPrefixesFromAttributes(attrs) {
		let data = Object.assign({}, attrs);
		for(let name in data) {
			if(name.startsWith(AstSerializer.prefixes.props)) {
				let newName = name.slice(1);
				data[newName] = data[name];
				delete data[name];
			}
		}
		return data;
	}

	static getString(attrs, data, globalData) {
		let str = [];
		let attrObject = attrs;
		if(Array.isArray(attrObject)) {
			attrObject = AttributeSerializer.dedupeAttributes(attrs);
		}

		for(let key in attrObject) {
			let {name, value} = AttributeSerializer.normalizeAttribute(key, attrObject[key], data, globalData);
			if(name.startsWith(AstSerializer.prefixes.props) || value === false) {
				continue;
			}

			// Note that AST from parse5 returns <* attrName> as { attrName: "" } instead of undefined
			str.push(` ${name}${value !== "" ? `="${value}"` : ""}`);
		}
		return str.join("");
	}
}

export { AttributeSerializer };