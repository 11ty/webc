import fs from "fs";
import { ParserStream } from "parse5-parser-stream";
import { Readable } from "stream";
// import * as parse5 from "parse5";

class AstSerializer {
	constructor(options = {}) {
		let { mode } = Object.assign({
			mode: "component", // or "page"
		}, options);

		// controls whether or not doctype, html, body are prepended to content
		this.mode = mode;
	}

	/* Custom HTML attributes */
	static attrs = {
		TYPE: "webc:type",
		KEEP: "webc:keep",
		RAW: "webc:raw",
	}

	// List from the parse5 serializer
	// https://github.com/inikulin/parse5/blob/3955dcc158031cc773a18517d2eabe8b17107aa3/packages/parse5/lib/serializer/index.ts
	static voidElements = {
		area: true,
		base: true,
		basefont: true,
		bgsound: true,
		br: true,
		col: true,
		embed: true,
		frame: true,
		hr: true,
		img: true,
		input: true,
		keygen: true,
		link: true,
		meta: true,
		param: true,
		source: true,
		track: true,
		wbr: true,
	};

	isVoidElement(tagName) {
		return AstSerializer.voidElements[tagName] || false;
	}

	getAttributesString(tagName, attrs) {
		if(tagName === "style") {
			attrs = attrs.filter(({name, value}) => {
				if(name === "type" && value === "text/css") {
					return false;
				}
				return true;
			});
		}

		return attrs.filter(({name}) => !name.startsWith("webc:")).map(({name, value}) => ` ${name}="${value}"`).join("");
	}

	hasAttribute(node, attributeName) {
		return !!(node.attrs || []).find(({name}) => name === attributeName);
	}

	getAttributeValue(node, attributeName) {
		let nameAttr = (node.attrs || []).find(({name}) => name === attributeName);

		if(!nameAttr) {
			// Same as Element.getAttribute
			// https://developer.mozilla.org/en-US/docs/Web/API/Element/getAttribute
			return null;
		}

		return nameAttr?.value;
	}

	findElement(root, tagName) {
		if(root.tagName === tagName) {
			return root;
		}
		for(let child of root.childNodes || []) {
			let node = this.findElement(child, tagName);
			if(node) {
				return node;
			}
		}
	}

	hasTextContent(node) {
		for(let child of node.childNodes || []) {
			if(child.nodeName === "#text" && (child.value || "").trim().length > 0) {
				return true;
			}
		}
		return false;
	}

	hasNonEmptyChildren(parentNode, tagNames) {
		if(!parentNode) {
			return false;
		}
		if(!tagNames || Array.isArray(tagNames)) {
			tagNames = new Set(tagNames);
		}

		for(let child of parentNode.childNodes || []) {
			if(tagNames.has(child.tagName) && this.hasTextContent(child)) {
				return true;
			}
		}
		return false;
	}

	ignoreComponentParentTag(component) {
		let body = this.findElement(component, "body");

		// do not ignore if <style> or <script> in component definition
		// TODO(v2): link[rel="stylesheet"]
		if(this.hasNonEmptyChildren(body, ["style", "script"])) {
			return false;
		}
		return true;
	}

	isIgnored(node) {
		let { tagName } = node;

		if(this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
			return false;
		}
		if(this.getAttributeValue(node, AstSerializer.attrs.TYPE)) { // Must come after webc:keep (takes precedence)
			return true;
		}

		// TODO override here to always include the parent node
		let component = this.components[node.tagName];
		if(component) {
			if(this.componentIgnoreRootTag[node.tagName]) {
				// do not include the parent element if this component has no styles or script associated with it
				return true;
			}
		}

		if(tagName === "head" || tagName === "body" || tagName === "html") {
			if(this.mode === "component") {
				return true;
			}
		}
		if(tagName === "slot") {
			return true;
		}

		return false;
	}

	// Allow options.slots to be strings
	async getSlotAst(slot) {
		if(typeof slot === "string") {
			return WebC.getASTFromString(slot);
		}
		return slot;
	}

	setComponents(components = {}) {
		this.components = components || {};

		this.componentIgnoreRootTag = {};
		for(let name in components) {
			this.componentIgnoreRootTag[name] = this.ignoreComponentParentTag(components[name]);
		}
	}

	async getChildContent(parentNode, slots, options) {
		let promises = [];
		for(let child of parentNode.childNodes || []) {
			promises.push(this.compile(child, slots, options))
		}
		let p = await Promise.all(promises);
		let html = p.map(entry => entry.html).join("");

		return {
			html
		};
	}

	getSlotNodes(node, slots = {}) {
		let defaultSlot = [];
		for(let child of node.childNodes) {
			let slotName = this.getAttributeValue(child, "slot");
			if(slotName) {
				slots[slotName] = child;
			} else {
				defaultSlot.push(child);
			}
		}
		// faking a real AST by returning an object with childNodes
		slots.default = { childNodes: defaultSlot };
		return slots;
	}

	async compile(node, slots = {}, options = {}) {
		options = Object.assign({
			rawMode: false,
			transforms: {},
		}, options);

		let content = "";

		// Transforms can alter HTML content e.g. <template webc:type="markdown">
		let transformType = this.getAttributeValue(node, AstSerializer.attrs.TYPE);
		if(transformType && !!options.transforms[transformType]) {
			options.currentTransformType = transformType;
		}

		let rawMode = this.hasAttribute(node, AstSerializer.attrs.RAW);
		if(rawMode) {
			options.rawMode = rawMode;
		}

		let slotSource = this.getAttributeValue(node, "slot");

		// Start tag
		if(node.tagName) {
			// parse5 doesn’t preserve whitespace around <html>, <head>, and after </body>
			if(this.mode === "page" && node.tagName === "head") {
				content += `\n`;
			}

			if(options.rawMode || !this.isIgnored(node, options) && !slotSource) {
				content += `<${node.tagName}${this.getAttributesString(node.tagName, node.attrs)}>`;
			}
		}

		// Content
		let componentHasContent = false;
		if(!options.rawMode && this.components[node.tagName]) {
			let slots = this.getSlotNodes(node);
			let { html: foreshadowDom } = await this.compile(this.components[node.tagName], slots, options);
			componentHasContent = foreshadowDom.trim().length > 0;

			content += foreshadowDom;
		}

		// Skip the remaining content is we have foreshadow dom!
		if(!componentHasContent) {
			if(node.nodeName === "#text") {
				content += node.value;
			} else if(node.nodeName === "#comment") {
				content += `<!--${node.data}-->`;
			} else if(this.mode === "page" && node.nodeName === "#documentType") {
				content += `<!doctype ${node.name}>\n`;
			}

			if(!options.rawMode && node.tagName === "slot") { // <slot> node
				let slotName = this.getAttributeValue(node, "name") || "default"

				if(slots[slotName]) {
					let slotAst = await this.getSlotAst(slots[slotName]);
					let { html: slotHtml } = await this.getChildContent(slotAst, null, options);
					content += slotHtml;
				} else {
					// Use fallback content in <slot> if no slot source exists to fill it
					let { html: slotFallbackHtml } = await this.getChildContent(node, null, options);
					content += slotFallbackHtml;
				}
			} else if(!options.rawMode && slotSource) {
				// do nothing if this is a <tag slot=""> attribute source: do not add to content
			} else if(node.content) {
				let { html: rawContent } = await this.compile(node.content, slots, options);
				if(options.currentTransformType) {
					rawContent = await options.transforms[options.currentTransformType](rawContent);
				}
				content += rawContent;
			} else if(node.childNodes?.length > 0) {
				let { html: childContent } = await this.getChildContent(node, slots, options);
				content += childContent;
			}
		}

		// End tag
		if(node.tagName) {
			if(this.isVoidElement(node.tagName)) {
				// do nothing: void elements don’t have closing tags
			} else if(options.rawMode || !this.isIgnored(node, options) && !slotSource) {
				content += `</${node.tagName}>`;
			}

			if(this.mode === "page" && node.tagName === "body") {
				content += `\n`;
			}
		}

		return {
			html: content
		};
	}
}

class WebC {
	constructor(options = {}) {
		let { file, input, mode } = options;

		this.customTransforms = {};

		if(file) {
			this.filePath = file;
		}
		if(input) {
			this.rawInput = input;
		}

		this.astOptions = {
			mode: mode || "component"
		};
	}

	setInputPath(file) {
		this.filePath = file;
	}

	setInput(input) {
		this.rawInput = input;
	}

	getInput() {
		if(this.filePath) {
			return fs.createReadStream(this.filePath, {
				encoding: "utf8"
			});
		} else if(this.rawInput) {
			return Readable.from(this.rawInput);
		} else {
			throw new Error("Missing a setInput or setInputPath method call to set the input.");
		}
	}

	static async getASTFromString(string) {
		let wc = new WebC({
			input: string
		});
		return wc.getAST();
	}

	static async getASTFromFilePath(filePath) {
		let wc = new WebC({
			file: filePath
		});
		return wc.getAST();
	}

	async getAST(inputStream) {
		if(!inputStream) {
			inputStream = this.getInput();
		}

		// TODO reject and "error"
		return new Promise((resolve, reject) => {
			let parser = new ParserStream({
				scriptEnabled: true, // Toggles <noscript> parsing as text
			});

			// Content should have no-quirks-mode nested in <body> semantics
			if(this.astOptions.mode === "component") {
				parser.once("pipe", function() {
					this.write(`<!doctype html><body>`);
				});
			}

			parser.once("finish", function() {
				resolve(parser.document);
			});

			inputStream.pipe(parser);
		});
	}

	addCustomTransform(key, callback) {
		this.customTransforms[key] = callback;
	}

	async compile(options = {}) {
		let rawAst = await this.getAST();

		let ast = new AstSerializer(this.astOptions);
		ast.setComponents(options.components);

		return ast.compile(rawAst, options.slots, {
			transforms: this.customTransforms
		});
	}
}

export { WebC };