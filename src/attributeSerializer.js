import { AstSerializer } from "./ast.js";
import { ModuleScript } from "./moduleScript.cjs";
import { escapeAttribute } from 'entities/lib/escape.js';

class AttributeSerializer {
	// Merge multiple style/class attributes into a single one
	// Removes webc: attributes
	// Usage by: `getString` function when writing attributes to the HTML tag output
	// Usage by: when generating data object for render functions
	static dedupeAttributes(attrs = []) {
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

		// don’t mutate those original attr objects!
		for(let j = 0, k = attrs.length; j<k; j++) {
			delete attrs[j].skipped;
		}

		return attrObject;
	}

	// Inputs are guaranteed to be lower case (per the HTML specification)
	static camelCaseAttributeName(name) {
		const DASH = "-";
		if(name.includes(DASH)) {
			return name.split(DASH).map((entry, j) => {
				if(j === 0) {
					return entry;
				}
				return entry.slice(0, 1).toUpperCase() + entry.slice(1);
			}).join("");
		}
		return name;
	}

	static peekAttribute(name) {
		if(name.startsWith(AstSerializer.prefixes.props)) {
			return {
				name: name.slice(AstSerializer.prefixes.props.length),
				type: "private", // property
			};
		}

		if(name.startsWith(AstSerializer.prefixes.dynamic)) {
			return {
				name: name.slice(AstSerializer.prefixes.dynamic.length),
				type: "script",
			};
		}

		return {
			name,
		};
	}

	static async normalizeAttribute(rawName, value, data) {
		let {name, type} = AttributeSerializer.peekAttribute(rawName);

		if(type === "script") {
			let attrValue = await ModuleScript.evaluateScript(rawName, value, data);

			return {
				name,
				value: attrValue,
			};
		}

		return {
			name,
			value,
		};
	}

	// Remove props prefixes, swaps dash to camelcase
	static async normalizeAttributesForData(attrs, data) {
		let newData = {};

		// dynamic props from host components need to be normalized
		for(let key in data) {
			let {type} = AttributeSerializer.peekAttribute(key);
			if(type === "script") {
				let { name, value } = await AttributeSerializer.normalizeAttribute(key, data[key], data || {});
				data[name] = value;
				delete data[key];
			}
		}

		for(let originalName in attrs) {
			let { name, value } = await AttributeSerializer.normalizeAttribute(originalName, attrs[originalName], data || {});

			// prop does nothing
			// prop-name becomes propName
			// @prop-name becomes propName
			name = AttributeSerializer.camelCaseAttributeName(name);

			newData[name] = value;
		}

		return newData;
	}

	// Change :dynamic to `dynamic` for data resolution
	static convertAttributesToDataObject(attrs) {
		let data = {};
		for(let {name, value} of attrs || []) {
			data[name] = value;
		}
		return data;
	}

	static async getString(attrs, data) {
		let str = [];
		let attrObject = attrs;
		if(Array.isArray(attrObject)) {
			attrObject = AttributeSerializer.dedupeAttributes(attrs);
		}

		for(let key in attrObject) {
			let {type} = AttributeSerializer.peekAttribute(key);
			if(type === "private") { // properties
				continue;
			}

			let {name, value} = await AttributeSerializer.normalizeAttribute(key, attrObject[key], data);

			// Note we filter any falsy attributes (except "")
			if(!value && value !== "") {
				continue;
			}

			// Note that AST from parse5 returns <* attrName> as { attrName: "" } instead of undefined
			if (value !== "") {
				// Note that backslash does *not* escape nested quotes in HTML
				// e.g. <* attrName="\"test"> parses as <* attrName="\" test"="">
				// via https://github.com/inikulin/parse5/blob/159ef28fb287665b118c71e1c5c65aba58979e40/packages/parse5-html-rewriting-stream/lib/index.ts
				if(typeof value !== "string") {
					value = `${value}`;
				}
				value = `="${escapeAttribute(value)}"`
			}

			str.push(` ${name}${value}`);
		}
		return str.join("");
	}
}

export { AttributeSerializer };