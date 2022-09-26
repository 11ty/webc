import { AstSerializer } from "./ast.js";
import { ModuleScript } from "./moduleScript.js";
import { escapeAttribute } from 'entities/lib/escape.js';

class AttributeSerializer {
	static dedupeAttributes(attrs = []) {
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

		// don’t mutate those original attr objects!
		for(let j = 0, k = attrs.length; j<k; j++) {
			delete attrs[j].skipped;
		}

		return attrObject;
	}

	static normalizeAttribute(name, value, data, globalData) {
		if(name.startsWith(AstSerializer.prefixes.dynamic)) {
			let fn = ModuleScript.evaluateAttribute(value);
			let context = Object.assign({}, data, globalData);

			return {
				name: name.slice(1),
				value: fn.call(context),
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
				let newName = name.slice(AstSerializer.prefixes.props.length);
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
			if(name.startsWith(AstSerializer.prefixes.props) || !value && value !== "") {
				continue;
			}

			// Note that AST from parse5 returns <* attrName> as { attrName: "" } instead of undefined
			if (value !== "") {
				// Note that backslash does *not* escape nested quotes in HTML
				// e.g. <* attrName="\"test"> parses as <* attrName="\" test"="">
				// via https://github.com/inikulin/parse5/blob/159ef28fb287665b118c71e1c5c65aba58979e40/packages/parse5-html-rewriting-stream/lib/index.ts
				value = `="${escapeAttribute(value)}"`
			}

			str.push(` ${name}${value}`);
		}
		return str.join("");
	}
}

export { AttributeSerializer };