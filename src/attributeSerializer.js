import { ModuleScript } from "./moduleScript.cjs";
import { escapeAttribute } from 'entities/lib/escape.js';

class AttributeSerializer {
	static prefixes = {
		prop: "@",
		dynamic: ":",
		dynamicProp: ":@",
	}

	// Merge multiple style/class attributes into a single one, operates on :dynamic and @prop but with transformed values
	// Usage by: `getString` function when writing attributes to the HTML tag output
	// Usage by: when generating data object for render functions
	static mergeAttributes(attrs = []) {
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
			if(!merged[name]) {
				continue;
			}

			if(typeof value !== "string") {
				value = value.toString();
			}
			for(let splitVal of value.toString().split(merged[name].splitDelimiter)) {
				splitVal = splitVal.trim();
				if(splitVal) {
					merged[name].value.push(splitVal);
				}
			}
		}

		let attrObject = {};
		for(let {name, value, privacy} of attrs) {
			// Used merged values
			if(merged[name]) {
				continue;
			} else {
				attrObject[name] = value;

				AttributeSerializer.setKeyPrivacy(attrObject, name, privacy);
			}
		}

		for(let name in merged) {
			let set = merged[name].value;
			if(merged[name].deduplicate) {
				set = Array.from(new Set(set));
			}

			let mergedValue = set.join(merged[name].joinDelimiter);
			if(mergedValue) {
				attrObject[name] = mergedValue;
			}
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
		if(name.startsWith(AttributeSerializer.prefixes.dynamicProp)) {
			return {
				name: name.slice(AttributeSerializer.prefixes.dynamicProp.length),
				privacy: "private", // property
				evaluation: "script",
			};
		}

		if(name.startsWith(AttributeSerializer.prefixes.prop)) {
			return {
				name: name.slice(AttributeSerializer.prefixes.prop.length),
				privacy: "private", // property
				evaluation: false,
			};
		}

		if(name.startsWith(AttributeSerializer.prefixes.dynamic)) {
			return {
				name: name.slice(AttributeSerializer.prefixes.dynamic.length),
				privacy: "public",
				evaluation: "script",
			};
		}

		return {
			name,
			privacy: name.startsWith("webc:") ? "private" : "public",
			evaluation: false,
		};
	}

	// Remove props prefixes, swaps dash to camelcase
	// Keeps private entries (used in data)
	static async normalizeAttributesForData(attrs) {
		let newData = {};

		for(let name in attrs) {
			let value = attrs[name];

			// prop does nothing
			// prop-name becomes propName
			// @prop-name and :prop-name prefixes should already be removed
			newData[AttributeSerializer.camelCaseAttributeName(name)] = value;

			// Maintain privacy in new object
			let privacy = attrs[`${name}___webc_privacy`];
			if(privacy) {
				AttributeSerializer.setKeyPrivacy(newData, name, privacy);
			}
		}

		return newData;
	}

	static getPublicAttributesAsObject(attrs) {
		let newData = {};

		for(let name in attrs) {
			// Maintain privacy in new object
			let privacy = attrs[`${name}___webc_privacy`];
			if(privacy !== "private") {
				newData[name] = attrs[name];
			}
		}

		return newData;
	}

	static async evaluateAttribute(rawName, value, data, scriptContextKey) {
		let {name, evaluation, privacy} = AttributeSerializer.peekAttribute(rawName);
		let evaluatedValue = value;
		if(evaluation === "script") {
			let { returns } = await ModuleScript.evaluateScriptInline(value, data, `Evaluating a dynamic ${rawName.startsWith(AttributeSerializer.prefixes.dynamicProp) ? 'prop' : 'attribute' } failed: \`${rawName}="${value}"\`.`, scriptContextKey);
			evaluatedValue = returns;
		}

		return {
			name,
			rawName,
			value: evaluatedValue,
			rawValue: value,
			evaluation,
			privacy,
		};
	}

	// attributesArray: parse5 format, Array of [{name, value}]
	// returns: same array with additional properties added
	static async evaluateAttributesArray(attributesArray, data, scriptContextKey) {
		let evaluated = [];
		for(let attr of attributesArray) {
			evaluated.push(AttributeSerializer.evaluateAttribute(attr.name, attr.value, data, scriptContextKey).then((result) => {
				let { name, rawName, value, rawValue, evaluation, privacy } = result;
				let entry = {};
				entry.rawName = rawName;
				entry.rawValue = rawValue;

				entry.name = name;
				entry.value = value;
				entry.privacy = privacy;
				entry.evaluation = evaluation;
				return entry;
			}));
		}
		return Promise.all(evaluated);
	}

	static setKeyPrivacy(obj, name, privacy) {
		Object.defineProperty(obj, `${name}___webc_privacy`, {
			value: privacy || "private"
		});
	}

	static getString(finalAttributesObject) {
		let str = [];

		for(let name in finalAttributesObject) {
			let value = finalAttributesObject[name];

			// Filter out private props (including webc:)
			if(finalAttributesObject[`${name}___webc_privacy`] === "private") {
				continue;
			}

			// don’t cast `undefined`, `false` to "undefined", "false"
			if(value || value === "") {
				value = `${value}`;
			}

			// Note that AST from parse5 returns <* attrName> as { attrName: "" } instead of undefined
			if (value && value !== "") {
				// Note that backslash does *not* escape nested quotes in HTML
				// e.g. <* attrName="\"test"> parses as <* attrName="\" test"="">
				// via https://github.com/inikulin/parse5/blob/159ef28fb287665b118c71e1c5c65aba58979e40/packages/parse5-html-rewriting-stream/lib/index.ts
				value = `="${escapeAttribute(value)}"`
			}

			if(value || value === "") {
				str.push(` ${name}${value}`);
			}
		}
		return str.join("");
	}
}

export { AttributeSerializer };
