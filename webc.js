import fs from "fs";
import path from "path";
import { ParserStream } from "parse5-parser-stream";
import { Readable } from "stream";
import { DepGraph } from "dependency-graph";

class AstSerializer {
	constructor(options = {}) {
		let { mode, filePath } = Object.assign({
			mode: "component", // or "page"
			filePath: undefined,
		}, options);

		// controls whether or not doctype, html, body are prepended to content
		this.mode = mode;

		// for error messaging
		this.filePath = filePath;

		// Component cache
		this.componentMap = {};
		this.components = {};
	}

	/* Custom HTML attributes */
	static attrs = {
		TYPE: "webc:type",
		KEEP: "webc:keep",
		RAW: "webc:raw",
		IS: "webc:is",
		ROOT: "webc:root",
		IMPORT: "webc:import",
	};

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

	getAttributesString(attrs) {
		// Merge multiple class attributes into a single one
		let merged = {
			class: {
				value: [],
				delimiter: " ",
			}
		};

		for(let j = 0, k = attrs.length; j<k; j++) {
			let {name, value} = attrs[j];
			if(merged[name]) {
				// set skipped for 2nd+ dupes
				if(merged[name].value.length > 0) {
					attrs[j].skipped = true;
				}
				merged[name].value.push(value);
			}
		}

		let filteredAttrs = attrs.filter(({name, skipped}) => {
			return !skipped && !name.startsWith("webc:");
		}).map(({name, value}) => {
			// Used merged values
			if(merged[name]) {
				value = merged[name].value.join(merged[name].delimiter);
			}
			return ` ${name}="${value}"`;
		});
		return filteredAttrs.join("");
	}

	hasAttribute(node, attributeName) {
		return (node.attrs || []).find(({name}) => name === attributeName) !== undefined;
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
		let rootTagName = this.getTagName(root);
		if(rootTagName === tagName) {
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
			let tagName = this.getTagName(child);
			if(tagNames.has(tagName) && this.hasTextContent(child)) {
				return true;
			}
		}
		return false;
	}

	getWebcRootAttributes(component) {
		let tmpl = this.findElement(component, "template");
		if(tmpl && this.hasAttribute(tmpl, AstSerializer.attrs.ROOT)) {
			return tmpl.attrs.filter(entry => entry.name !== AstSerializer.attrs.ROOT);
		}
		return [];
	}

	ignoreComponentParentTag(component) {
		// First <template> has a webc:root
		let root = this.findElement(component, "template");
		if(root && this.hasAttribute(root, AstSerializer.attrs.ROOT)) {
			return false;
		}

		let body = this.findElement(component, "body");
		// do not ignore if <style> or <script> in component definition
		// TODO(v2): link[rel="stylesheet"]
		if(this.hasNonEmptyChildren(body, ["style", "script"])) {
			return false;
		}

		return true;
	}

	isIgnored(node) {
		let tagName = this.getTagName(node);

		if(this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
			// do not ignore
			return false;
		}

		if(this.hasAttribute(node, AstSerializer.attrs.ROOT)) {
			return true;
		}

		// Must come after webc:keep (takes precedence)
		if(this.hasAttribute(node, AstSerializer.attrs.TYPE)) {
			return true;
		}

		
		let component = this.getComponent(tagName);
		if(component?.ignoreRootTag) {
			// do not include the parent element if this component has no styles or script associated with it
			return true;
		}

		if(this.mode === "component") {
			if(tagName === "head" || tagName === "body" || tagName === "html") {
				return true;
			}
		}

		if(tagName === "slot") {
			return true;
		}

		// aggregation tags
		if(tagName === "style" || tagName === "script") {
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

	async precompileComponent(filePath) {
		// component cache
		if(!this.components[filePath]) {
			// this is async—caches the promise
			let ast = await WebC.getASTFromFilePath(filePath);

			this.components[filePath] = {
				ast,
				ignoreRootTag: this.ignoreComponentParentTag(ast),
				rootAttributes: this.getWebcRootAttributes(ast)
			};
		}
	}

	// synchronous (components should already be cached)
	getComponent(name) {
		if(!name || !this.componentMap[name]) {
			// render as a plain-ol-tag
			return false;
		}

		let filePath = this.componentMap[name];
		if(!this.components[filePath]) {
			throw new Error(`Component at "${filePath}" not found in the component registry.`);
		}
		return this.components[filePath];
	}

	// `components` object maps from component name => filename
	async setComponents(components = {}) {
		Object.assign(this.componentMap, components || {});

		// precompile components
		let promises = [];
		for(let name in components) {
			promises.push(this.precompileComponent(components[name]));
		}
		await Promise.all(promises);
	}

	async getChildContent(parentNode, slots, options) {
		let promises = [];
		for(let child of parentNode.childNodes || []) {
			promises.push(this.compileNode(child, slots, options))
		}
		let p = await Promise.all(promises);
		let html = p.map(entry => entry.html).join("");

		return {
			html,
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

	logNode(node) {
		let c = structuredClone(node);
		delete c.parentNode;
		return c;
	}

	getOrderedAssets(componentList, assetObject) {
		let assets = new Set();
		for(let component of componentList) {
			if(assetObject[component]) {
				for(let entry of assetObject[component]) {
					assets.add(entry);
				}
			}
		}
		return Array.from(assets);
	}

	getTagName(node) {
		let is = this.getAttributeValue(node, AstSerializer.attrs.IS);
		return is || node.tagName;
	}

	renderStartTag(node, tagName, slotSource, options) {
		let content = "";

		if(tagName) {
			// parse5 doesn’t preserve whitespace around <html>, <head>, and after </body>
			if(this.mode === "page" && tagName === "head") {
				content += `\n`;
			}

			if(options.rawMode || !this.isIgnored(node, options) && !slotSource) {
				let attrs = node.attrs.slice(0);
				let component = this.getComponent(tagName);
				if(component && Array.isArray(component.rootAttributes)) {
					attrs.push(...component.rootAttributes);
				}
				content += `<${tagName}${this.getAttributesString(attrs)}>`;
			}
		}
		return content;
	}

	renderEndTag(node, tagName, slotSource, options) {
		let content = "";
		if(tagName) {
			if(this.isVoidElement(tagName)) {
				// do nothing: void elements don’t have closing tags
			} else if(options.rawMode || !this.isIgnored(node, options) && !slotSource) {
				content += `</${tagName}>`;
			}

			if(this.mode === "page" && tagName === "body") {
				content += `\n`;
			}
		}
		return content;
	}

	async importComponent(tagName, filePath) {
		let parsed = path.parse(this.filePath);
		let relativeFromRoot = path.join(parsed.dir, filePath);
		let finalFilePath = `.${path.sep}${relativeFromRoot}`;

		this.componentMap[tagName] = finalFilePath;

		await this.precompileComponent(finalFilePath);
	}

	async compileNode(node, slots = {}, options = {}) {
		options = Object.assign({}, options);

		let content = "";

		// Transforms can alter HTML content e.g. <template webc:type="markdown">
		let transformType = this.getAttributeValue(node, AstSerializer.attrs.TYPE);
		if(transformType && !!options.transforms[transformType]) {
			options.currentTransformType = transformType;
		}

		if(this.hasAttribute(node, AstSerializer.attrs.RAW)) {
			options.rawMode = true;
		}

		let tagName = this.getTagName(node);
		let importSource = this.getAttributeValue(node, AstSerializer.attrs.IMPORT);
		if(importSource) {
			await this.importComponent(tagName, importSource);
		}

		let slotSource = this.getAttributeValue(node, "slot");
		if(slotSource) {
			options.isSlotContent = true;
		}

		// Start tag
		content += this.renderStartTag(node, tagName, slotSource, options);

		// light dom content
		let componentHasContent = null;
		let component = this.getComponent(tagName);
		if(!options.rawMode && component) {
			let componentFilePath = this.componentMap[tagName];
			if(!options.components.hasNode(componentFilePath)) {
				options.components.addNode(componentFilePath);
			}

			if(options.closestParentComponent) {
				// Slotted content is not counted for circular dependency checks (semantically it is an argument, not a core dependency)
				// <web-component><child/></web-component>
				if(!options.isSlotContent) {
					if(options.closestParentComponent === componentFilePath || options.components.dependenciesOf(options.closestParentComponent).find(entry => entry === componentFilePath) !== undefined) {
						throw new Error(`Circular dependency error: You cannot *use* <${tagName}> inside the definition for ${options.closestParentComponent}`);
					}
				}
				options.components.addDependency(options.closestParentComponent, componentFilePath);
			}

			// reset for next time
			options.closestParentComponent = componentFilePath;

			let slots = this.getSlotNodes(node);
			let { html: foreshadowDom } = await this.compileNode(component.ast, slots, options);
			componentHasContent = foreshadowDom.trim().length > 0;

			content += foreshadowDom;
		}

		// Skip the remaining content is we have foreshadow dom!
		if(!componentHasContent) {
			// this.log( node, { options } );
			if(node.nodeName === "#text") {
				content += node.value;
			} else if(node.nodeName === "#comment") {
				content += `<!--${node.data}-->`;
			} else if(this.mode === "page" && node.nodeName === "#documentType") {
				content += `<!doctype ${node.name}>\n`;
			}

			if(!options.rawMode && tagName === "slot") { // <slot> node
				options.isSlotContent = true;

				let slotName = this.getAttributeValue(node, "name") || "default";
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
				// do nothing if this is a <tag slot=""> attribute source: do not add to compiled content
			} else if(node.content) {
				let { html: rawContent } = await this.compileNode(node.content, slots, options);

				if(options.currentTransformType) {
					rawContent = await options.transforms[options.currentTransformType](rawContent);
				}

				content += rawContent;
			} else if(node.childNodes?.length > 0) {
				if(componentHasContent === false) {
					options.isSlotContent = true;
				}
				let { html: childContent } = await this.getChildContent(node, slots, options);

				let key = {
					style: "css",
					script: "js",
				}[ tagName ];

				if(key && !this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
					if(!options[key][options.closestParentComponent]) {
						options[key][options.closestParentComponent] = new Set();
					}
					options[key][options.closestParentComponent].add( childContent );
				} else {
					content += childContent;
				}
			}
		}

		// End tag
		content += this.renderEndTag(node, tagName, slotSource, options);

		// Disable raw mode again
		if(this.hasAttribute(node, AstSerializer.attrs.RAW)) {
			options.rawMode = false;
		}

		return {
			html: content,
		}
	}

	async compile(node, slots = {}, options = {}) {
		options = Object.assign({
			rawMode: false,
			isSlotContent: false,
			transforms: {},
			css: {},
			js: {},
			components: new DepGraph({ circular: true }),
		}, options);

		let compiled = await this.compileNode(node, slots, options);
		let content = compiled.html;
		let componentOrder = options.components.overallOrder().reverse();

		let ret = {
			html: content,
			css: this.getOrderedAssets(componentOrder, options.css),
			js: this.getOrderedAssets(componentOrder, options.js),
			components: componentOrder,
		};
		return ret;
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
			mode: mode || "component",
			filePath: file,
		};
	}

	setInputPath(file) {
		this.filePath = file;
		this.astOptions.filePath = file;
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
				parser.write(`<!doctype html><body>`);
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
		await ast.setComponents(options.components);

		return ast.compile(rawAst, options.slots, {
			transforms: this.customTransforms
		});
	}
}

export { WebC };