import path from "path";
import { createHash } from "crypto";
import { DepGraph } from "dependency-graph";

import { WebC } from "../webc.js";
import { Path } from "./path.js";
import { AssetManager } from "./assetManager.js";
import { CssPrefixer } from "./css.js";
import { AttributeSerializer } from "./attributeSerializer.js";
import { ModuleScript } from "./moduleScript.js";
import { Streams } from "./streams.js";

class AstSerializer {
	constructor(options = {}) {
		let { filePath } = Object.assign({
			filePath: undefined,
		}, options);

		// controls whether or not doctype, html, body are prepended to content
		this.mode = "component";

		// for error messaging
		this.filePath = Path.normalizePath(filePath);

		// content transforms
		this.transforms = {};

		// helper functions are used in @html and render functions
		// TODO lookup attributes too?
		this.helpers = {};

		// transform scoped CSS with a hash prefix
		this.setTransform(AstSerializer.transformTypes.SCOPED, (content, component) => {
			let prefixer = new CssPrefixer(component.scopedStyleHash);
			prefixer.setFilePath(component.filePath);
			return prefixer.process(content);
		});

		this.setTransform(AstSerializer.transformTypes.RENDER, async (content, component, data) => {
			let fn = ModuleScript.getModule(content, this.filePath);
			let context = Object.assign({}, this.helpers, data, this.globalData);
			return fn.call(context);
		});

		// Component cache
		this.componentMap = {};
		this.components = {};

		this.hashOverrides = {};

		this.globalData = {};

		this.streams = new Streams(["html", "css", "js"]);
	}

	static prefixes = {
		props: "@",
		lookup: ":",
	}

	/* Custom HTML attributes */
	static attrs = {
		TYPE: "webc:type",
		KEEP: "webc:keep",
		NOKEEP: "webc:nokeep",
		RAW: "webc:raw",
		IS: "webc:is",
		ROOT: "webc:root",
		IMPORT: "webc:import", // import another webc inline
		SCOPED: "webc:scoped", // css scoping
		HTML: "@html",
	};

	static transformTypes = {
		RENDER: "render",
		SCOPED: "css:scoped",
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

	setMode(mode = "component") {
		this.mode = mode; // "page" or "component"
	}

	setHelper(name, callback) {
		this.helpers[name] = callback;
	}

	setTransform(name, callback) {
		this.transforms[name] = callback;
	}

	setData(data = {}) {
		this.globalData = data;
	}

	isVoidElement(tagName) {
		return AstSerializer.voidElements[tagName] || false;
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

	findElement(root, tagName, attrCheck = []) {
		let rootTagName = this.getTagName(root);
		if(rootTagName === tagName) {
			if(attrCheck.length === 0 || attrCheck.find(attr => this.hasAttribute(root, attr))) {
				return root;
			}
		}
		for(let child of root.childNodes || []) {
			let node = this.findElement(child, tagName, attrCheck);
			if(node) {
				return node;
			}
		}
	}

	findAllChildren(parentNode, tagNames = [], attrCheck = []) {
		if(!parentNode) {
			return [];
		}
		if(typeof tagNames === "string") {
			tagNames = [tagNames];
		}
		if(!tagNames || Array.isArray(tagNames)) {
			tagNames = new Set(tagNames);
		}

		let results = [];
		for(let child of parentNode.childNodes || []) {
			let tagName = this.getTagName(child);
			if(tagNames.size === 0 || tagNames.has(tagName)) {
				if(attrCheck.length === 0 || attrCheck.find(attr => this.hasAttribute(child, attr))) {
					results.push(child);
				}
			}
		}
		return results;
	}

	getTextContent(node) {
		let content = [];
		for(let child of node.childNodes || []) {
			if(child.nodeName === "#text") {
				content.push(child.value);
			}
		}
		return content;
	}

	hasTextContent(node) {
		return this.getTextContent(node).find(entry => entry.trim().length > 0) !== undefined;
	}

	getScopedStyleHash(component, filePath) {
		let prefix = "w";
		let hashLength = 8;
		let hash = createHash("sha256");
		let body = this.findElement(component, "body");

		// <style webc:scoped> must be nested at the root
		let styleNodes = this.findAllChildren(body, "style", [AstSerializer.attrs.SCOPED]);
		for(let node of styleNodes) {
			// Override hash with scoped="override"
			let override = this.getAttributeValue(node, AstSerializer.attrs.SCOPED);
			if(override) {
				if(this.hashOverrides[override]) {
					if(this.hashOverrides[override] !== filePath) {
						throw new Error(`You have \`webc:scoped\` override collisions! See ${this.hashOverrides[override]} and ${filePath}`);
					}
				} else {
					this.hashOverrides[override] = filePath;
				}

				return override;
			}

			// TODO handle <script webc:type="render" webc:is="style" webc:scoped> (see render-css.webc)
			let hashContent = this.getTextContent(node).toString();
			hash.update(hashContent);
		}

		if(styleNodes.length) { // don’t return a hash if empty
			return prefix + hash.digest("base64url").toLowerCase().slice(0, hashLength);
		}
	}

	ignoreComponentParentTag(component) {
		let body = this.findElement(component, "body");

		// Has <* webc:root> (has to be a root child, not script/style)
		let roots = this.findAllChildren(body, [], [AstSerializer.attrs.ROOT]);
		for(let child of roots) {
			let tagName = this.getTagName(child);
			if(tagName === "script" || tagName === "style") {
				continue;
			}

			if(this.hasAttribute(child, AstSerializer.attrs.ROOT)) {
				return false;
			}
		}

		// do not ignore if <style> or <script> in component definition (unless <style webc:root> or <script webc:root>)
		let children = this.findAllChildren(body, ["script", "style"]);
		for(let child of children) {
			if(!this.hasAttribute(child, AstSerializer.attrs.ROOT) && this.hasTextContent(child)) {
				return false;
			}
		}

		// Has <template shadowroot> (can be anywhere in the tree)
		let shadowroot = this.findElement(body, "template", ["shadowroot"]);
		if(shadowroot) {
			return false;
		}

		return true;
	}

	// filePath is already cross platform normalized (used by options.closestParentComponent)
	getMode(filePath) {
		return filePath && this.components[filePath] ? this.components[filePath].mode : this.mode;
	}

	isIgnored(node, component, renderingMode) {
		let tagName = this.getTagName(node);

		if(this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
			// do not ignore
			return false;
		}

		if(this.hasAttribute(node, AstSerializer.attrs.ROOT)) {
			return true;
		}

		// must come after webc:keep (takes precedence)
		if(this.hasAttribute(node, AstSerializer.attrs.NOKEEP)) {
			return true;
		}

		if(this.hasAttribute(node, AstSerializer.attrs.HTML)) {
			return false;
		}

		// Must come after webc:keep (takes precedence)
		if(this.hasAttribute(node, AstSerializer.attrs.TYPE)) {
			return true;
		}

		if(!component) {
			component = this.getComponent(tagName);
		}
		if(component?.ignoreRootTag) {
			// do not include the parent element if this component has no styles or script associated with it
			return true;
		}

		if(renderingMode === "component") {
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

	getRootNodes(node) {
		let body = this.findElement(node, "body");
		return this.findAllChildren(body, [], [AstSerializer.attrs.ROOT]);
	}

	getRootAttributes(component, scopedStyleHash) {
		let attrs = [];
		let roots = this.getRootNodes(component);
		for(let root of roots) {
			for(let attr of root.attrs.filter(entry => entry.name !== AstSerializer.attrs.ROOT)) {
				attrs.push(attr);
			}
		}

		if(scopedStyleHash) {
			// it’s okay if there are other `class` attributes, we merge them later
			attrs.push({ name: "class", value: scopedStyleHash });
		}

		return attrs;
	}

	async preparseComponent(filePath, ast) {
		if(this.components[filePath]) {
			return;
		}

		let isTopLevelComponent = !!ast;

		if(!ast) {
			ast = await WebC.getASTFromFilePath(filePath);
		}

		let scopedStyleHash = this.getScopedStyleHash(ast, filePath);
		this.components[filePath] = {
			filePath,
			ast,
			// if ast is provided, this is the top level component
			mode: isTopLevelComponent ? this.mode : "component",
			ignoreRootTag: this.ignoreComponentParentTag(ast),
			scopedStyleHash,
			rootAttributes: this.getRootAttributes(ast, scopedStyleHash),
		};
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
		let promises = [];
		for(let name in components) {
			let filePath = components[name];
			this.componentMap[name] = Path.normalizePath(filePath);

			promises.push(this.preparseComponent(this.componentMap[name]));
		}

		return Promise.all(promises);
	}

	// This *needs* to be depth first instead of breadth first for **streaming**
	async getChildContent(parentNode, slots, options, streamEnabled) {
		let html = [];
		for(let child of parentNode.childNodes || []) {
			let { html: nodeHtml } = await this.compileNode(child, slots, options, streamEnabled);
			html.push(nodeHtml);
		}

		return {
			html: html.join(""),
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

	getTagName(node) {
		let is = this.getAttributeValue(node, AstSerializer.attrs.IS);
		if(is) {
			return is;
		}

		return node.tagName;
	}

	getAttributes(node, component, options) {
		let attrs = node.attrs.slice(0);

		// If this is a top level page-component, make sure we get the top level attributes here
		if(!component && this.filePath === options.closestParentComponent && this.components[this.filePath]) {
			component = this.components[this.filePath];
		}

		if(component && Array.isArray(component.rootAttributes)) {
			attrs.push(...component.rootAttributes);
		}

		return attrs;
	}

	outputHtml(str, streamEnabled) {
		if(streamEnabled && str) {
			this.streams.output("html", str);
		}

		return str;
	}

	renderStartTag(node, tagName, slotSource, component, renderingMode, options) {
		let content = "";
		let attrObject;

		if(tagName) {
			// parse5 doesn’t preserve whitespace around <html>, <head>, and after </body>
			if(renderingMode === "page" && tagName === "head") {
				content += `\n`;
			}

			let attrs = this.getAttributes(node, component, options);
			attrObject = AttributeSerializer.dedupeAttributes(attrs);

			if(options.rawMode || !this.isIgnored(node, component, renderingMode) && !slotSource) {
				content += `<${tagName}${AttributeSerializer.getString(attrObject, options.componentProps, this.globalData)}>`;
			}
		}

		return {
			content,
			attrs: attrObject
		};
	}

	renderEndTag(node, tagName, slotSource, component, renderingMode, options) {
		let content = "";
		if(tagName) {
			if(this.isVoidElement(tagName)) {
				// do nothing: void elements don’t have closing tags
			} else if(options.rawMode || !this.isIgnored(node, component, renderingMode) && !slotSource) {
				content += `</${tagName}>`;
			}

			if(renderingMode === "page" && tagName === "body") {
				content += `\n`;
			}
		}
		return content;
	}

	async transformContent(content, transformTypes, parentComponent, options) {
		if(!transformTypes) {
			transformTypes = [];
		}
		for(let type of transformTypes) {
			content = await this.transforms[type](content, parentComponent, options.componentProps);
		}
		return content;
	}

	async importComponent(filePath) {
		if(!this.filePath) {
			throw new Error("Dynamic component import requires a filePath to be set.")
		}
		let parsed = path.parse(this.filePath);
		let relativeFromRoot = path.join(parsed.dir, filePath);
		let finalFilePath = Path.normalizePath(`.${path.sep}${relativeFromRoot}`);

		await this.preparseComponent(finalFilePath);

		return this.components[finalFilePath];
	}

	async getContentForSlot(node, slots, options) {
		let slotName = this.getAttributeValue(node, "name") || "default";
		if(slots[slotName]) {
			let slotAst = await this.getSlotAst(slots[slotName]);
			let { html: slotHtml } = await this.getChildContent(slotAst, null, options, true);
			return slotHtml;
		}

		// Use light dom fallback content in <slot> if no slot source exists to fill it
		let { html: slotFallbackHtml } = await this.getChildContent(node, null, options, true);
		return slotFallbackHtml;
	}

	async getContentForTemplate(node, slots, options) {
		let templateOptions = Object.assign({}, options);
		templateOptions.rawMode = true;
		// no transformation on this content
		delete templateOptions.currentTransformTypes;

		let { html: rawContent } = await this.compileNode(node.content, slots, templateOptions, false);
		// Get plaintext from <template> .content
		if(options.currentTransformTypes) {
			return this.transformContent(rawContent, options.currentTransformTypes, this.components[options.closestParentComponent], options);
		}
		return rawContent;
	}

	// Transforms can alter HTML content e.g. <template webc:type="markdown">
	getTransformTypes(node) {
		let types = new Set();
		let transformTypeStr = this.getAttributeValue(node, AstSerializer.attrs.TYPE);
		if(transformTypeStr) {
			for(let s of transformTypeStr.split(",")) {
				if(s && !!this.transforms[s]) {
					types.add(s);
				}
			}
		}

		if(this.hasAttribute(node, AstSerializer.attrs.SCOPED)) {
			types.add(AstSerializer.transformTypes.SCOPED);
		}
		return Array.from(types);
	}

	addComponentDependency(component, tagName, options) {
		let componentFilePath = Path.normalizePath(component.filePath);
		if(!options.components.hasNode(componentFilePath)) {
			options.components.addNode(componentFilePath);
		}

		if(options.closestParentComponent) {
			// Slotted content is not counted for circular dependency checks (semantically it is an argument, not a core dependency)
			// <web-component><child/></web-component>
			if(!options.isSlotContent) {
				if(options.closestParentComponent === componentFilePath || options.components.dependantsOf(options.closestParentComponent).find(entry => entry === componentFilePath) !== undefined) {
					throw new Error(`Circular dependency error: You cannot use <${tagName}> inside the definition for ${options.closestParentComponent}`);
				}
			}

			options.components.addDependency(options.closestParentComponent, componentFilePath);
		}

		// reset for next time
		options.closestParentComponent = Path.normalizePath(componentFilePath);
	}

	async compileNode(node, slots = {}, options = {}, streamEnabled = true) {
		options = Object.assign({}, options);

		let tagName = this.getTagName(node);
		let content = "";

		let transformTypes = this.getTransformTypes(node);
		if(transformTypes.length) {
			options.currentTransformTypes = transformTypes;
		}

		if(this.hasAttribute(node, AstSerializer.attrs.RAW)) {
			options.rawMode = true;
		}

		// Short circuit for text nodes, comments, doctypes
		let renderingMode = this.getMode(options.closestParentComponent);
		if(node.nodeName === "#text") {
			if(!options.currentTransformTypes || options.currentTransformTypes.length === 0) {
				content += this.outputHtml(node.value, streamEnabled);
			} else {
				content += this.outputHtml(await this.transformContent(node.value, options.currentTransformTypes, this.components[options.closestParentComponent], options), streamEnabled);
			}
			return { html: content };
		} else if(node.nodeName === "#comment") {
			return {
				html: this.outputHtml(`<!--${node.data}-->`, streamEnabled)
			};
		} else if(renderingMode === "page" && node.nodeName === "#documentType") {
			return {
				html: this.outputHtml(`<!doctype ${node.name}>\n`, streamEnabled)
			};
		}

		let component;
		let importSource = this.getAttributeValue(node, AstSerializer.attrs.IMPORT);
		if(importSource) {
			component = await this.importComponent(importSource);
		} else {
			component = this.getComponent(tagName);
		}

		let slotSource = this.getAttributeValue(node, "slot");
		if(slotSource) {
			options.isSlotContent = true;
		}

		// TODO warning if top level page component using a style hash but has no root element

		// Start tag
		let { content: startTagContent, attrs } = await this.renderStartTag(node, tagName, slotSource, component, renderingMode, options);
		content += this.outputHtml(startTagContent, streamEnabled);

		if(component) {
			options.componentProps = AttributeSerializer.removePropsPrefixesFromAttributes(attrs);
		}

		// Component content (foreshadow dom)
		let componentHasContent = null;
		let htmlAttribute = this.getAttributeValue(node, AstSerializer.attrs.HTML);
		if(htmlAttribute) {
			let fn = ModuleScript.evaluateAttribute(htmlAttribute, this.filePath);
			let context = Object.assign({}, this.helpers, options.componentProps, this.globalData);
			let htmlContent = await fn.call(context);
			componentHasContent = htmlContent.trim().length > 0;
			content += htmlContent;
		} else if(!options.rawMode && component) {
			this.addComponentDependency(component, tagName, options);

			let slots = this.getSlotNodes(node);
			let { html: foreshadowDom } = await this.compileNode(component.ast, slots, options, streamEnabled);
			componentHasContent = foreshadowDom.trim().length > 0;
			content += foreshadowDom;
		}

		// Skip the remaining content is we have foreshadow dom!
		if(!componentHasContent) {
			if(!options.rawMode && tagName === "slot") { // <slot> node
				options.isSlotContent = true;

				content += await this.getContentForSlot(node, slots, options);
			} else if(!options.rawMode && slotSource) {
				// do nothing if this is a <tag slot=""> attribute source: do not add to compiled content
			} else if(node.content) { // <template> content
				content += this.outputHtml(await this.getContentForTemplate(node, slots, options), streamEnabled);
			} else if(node.childNodes?.length > 0) {
				// Fallback to light DOM if no component dom exists
				if(componentHasContent === false) {
					options.isSlotContent = true;
				}

				if(options.rawMode) {
					let { html: childContent } = await this.getChildContent(node, slots, options, streamEnabled);
					content += childContent;
				} else if(tagName === "template" && options.currentTransformTypes) {
					let { html: childContent } = await this.getChildContent(node, slots, options, false);
					content += this.outputHtml(childContent, streamEnabled);
				} else {
					// aggregate CSS and JS
					let key = {
						style: "css",
						script: "js",
					}[ tagName ];

					if(key && !this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
						let { html: childContent } = await this.getChildContent(node, slots, options, false);
						let entryKey = options.closestParentComponent || this.filePath;
						if(!options[key][entryKey]) {
							options[key][entryKey] = new Set();
						}
						if(!options[key][entryKey].has(childContent)) {
							this.streams.output(key, childContent);
						}

						options[key][entryKey].add( childContent );
					} else {
						let { html: childContent } = await this.getChildContent(node, slots, options, streamEnabled);
						content += childContent;
					}
				}
			}
		}

		// End tag
		content += this.outputHtml(await this.renderEndTag(node, tagName, slotSource, component, renderingMode, options), streamEnabled);

		return {
			html: content,
		}
	}

	async compile(node, slots = {}, options = {}) {
		options = Object.assign({
			rawMode: false, // plaintext output
			isSlotContent: false,
			css: {},
			js: {},
			components: new DepGraph({ circular: true }),
			closestParentComponent: this.filePath,
		}, options);

		// parse the top level component
		if(this.filePath) {
			if(!this.components[this.filePath]) {
				await this.preparseComponent(this.filePath, node);
			}

			options.components.addNode(this.filePath);
		}

		try {
			if(node.mode === "quirks") {
				throw new Error(`Quirks mode rendering encountered${this.filePath ? ` for ${this.filePath}` : ""}. A <!doctype html> declaration *is* optional—did you specify a different doctype?`)
			}

			let compiled = await this.compileNode(node, slots, options);
			let content = compiled.html;
			let assets = new AssetManager(options.components);
	
			return {
				html: content,
				css: assets.getOrderedAssets(options.css),
				js: assets.getOrderedAssets(options.js),
				components: assets.orderedComponentList,
			};
		} catch(e) {
			this.streams.error("html", e);
			return Promise.reject(e);
		}
	}
}

export { AstSerializer };