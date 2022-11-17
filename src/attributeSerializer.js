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

	static async normalizeAttribute(name, value, data) {
		if(name.startsWith(AstSerializer.prefixes.dynamic)) {
			let attrValue = await ModuleScript.evaluateScript(name, value, data);

			return {
				name: name.slice(1),
				value: attrValue,
			};
		}
		return {
			name,
			value
		};
	}

	// Remove props prefixes, swaps dash to camelcase
	static normalizeAttributesForData(attrs) {
		let data = Object.assign({}, attrs);
		for(let name in data) {
			let newName = name;
			// prop does nothing
			// prop-name becomes propName
			// @prop-name becomes propName
			if(name.startsWith(AstSerializer.prefixes.props)) {
				newName = name.slice(AstSerializer.prefixes.props.length);
			}
			// TODO #71 default enabled in WebC v0.8.0
			// newName = AttributeSerializer.camelCaseAttributeName(newName);

			if(newName !== name) {
				data[newName] = data[name];
				delete data[name];
			}
		}

		return data;
	}

	static async getString(attrs, data, options) {
		let str = [];
		let attrObject = attrs;
		if(Array.isArray(attrObject)) {
			attrObject = AttributeSerializer.dedupeAttributes(attrs);
		}

		for(let key in attrObject) {
			let {name, value} = await AttributeSerializer.normalizeAttribute(key, attrObject[key], data, options);
			// Note we filter any falsy attributes (except "")
			if(name.startsWith(AstSerializer.prefixes.props) || !value && value !== "") {
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