import path from "path";
import fs from "fs";
import os from "os";
import { createHash } from "crypto";
import { DepGraph } from "dependency-graph";

import { WebC } from "../webc.js";
import { Path } from "./path.js";
import { AssetManager } from "./assetManager.js";
import { CssPrefixer } from "./css.js";
import { AttributeSerializer } from "./attributeSerializer.js";
import { ModuleScript } from "./moduleScript.cjs";
import { Streams } from "./streams.js";
import { escapeText } from "entities/lib/escape.js";
import { nanoid } from "nanoid";
import { ModuleResolution } from "./moduleResolution.js";

/** @typedef {import('parse5/dist/tree-adapters/default').Node} Node */
/** @typedef {import('parse5/dist/tree-adapters/default').Template} Template */
/** @typedef {import('parse5/dist/tree-adapters/default').TextNode} TextNode */
/** @typedef {{ [key: string]: Node | undefined, default?: Node | undefined }} Slots */
/**
 * @typedef {object} CompileOptions
 * @property {boolean} rawMode
 * @property {boolean} isSlottedContent
 * @property {boolean} isMatchingSlotSource
 * @property {string} closestParentComponent
 * @property {string} closestParentUid
 * @property {{ buckets: { [key: string]: Set<string> }, css: any, js: any }} assets
 * @property {DepGraph<any>} components
 * @property {{ uid: string }} [componentProps]
 * @property {Array<"render" | "css:scoped">} [currentTransformTypes]
 */

class FileSystemCache {
	constructor() {
		this.contents = {};
	}

	isFullUrl(filePath) {
		try {
			new URL(filePath);
			return true;
		} catch(e) {
			return false;
		}
	}

	static getRelativeFilePath(filePath, relativeTo) {
		if(relativeTo) {
			let parsed = path.parse(relativeTo);
			return path.join(parsed.dir, filePath);
		}
		return filePath;
	}

	isFileInProjectDirectory(filePath) {
		let workingDir = path.resolve();
		let absoluteFile = path.resolve(filePath);
		return absoluteFile.startsWith(workingDir);
	}

	read(filePath, relativeTo) {
		if(this.isFullUrl(filePath)) {
			throw new Error(`Full URLs in <script> and <link rel="stylesheet"> are not yet supported without webc:keep.`);
		}

		filePath = FileSystemCache.getRelativeFilePath(filePath, relativeTo);

		if(!this.isFileInProjectDirectory(filePath)) {
			throw new Error(`Invalid path ${filePath} is not in the working directory.`);
		}

		if(!this.contents[filePath]) {
			this.contents[filePath] = fs.readFileSync(filePath, {
				encoding: "utf8"
			});
		}

		return this.contents[filePath];
	}
}

class AstSerializer {
	constructor(options = {}) {
		let { filePath } = Object.assign({
			filePath: undefined,
		}, options);

		// Raw content parsed by AST (used for raw processing)
		this.content;

		// controls whether or not doctype, html, body are prepended to content
		this.mode = "component";

		// controls whether the assets are aggregated
		this.bundlerMode = false;

		// for error messaging
		this.filePath = Path.normalizePath(filePath);

		// content transforms
		this.transforms = {};

		// helper functions are used in @html and render functions
		// TODO lookup attributes too?
		this.helpers = {};

		// Module resolution aliases
		this.aliases = {};

		// transform scoped CSS with a hash prefix
		this.setTransform(AstSerializer.transformTypes.SCOPED, (content, component) => {
			if(!component.scopedStyleHash) {
				throw new Error("Could not find any top level <style webc:scoped> in component: " + component.filePath);
			}

			let prefixer = new CssPrefixer(component.scopedStyleHash);
			prefixer.setFilePath(component.filePath);
			return prefixer.process(content);
		});

		this.setTransform(AstSerializer.transformTypes.RENDER, async function(content) {
			let fn = ModuleScript.getModule(content, this.filePath);
			return fn.call(this);
		});

		this.setTransform(AstSerializer.transformTypes.JS, function(content) {
			// returns promise
			return ModuleScript.evaluateScript(`${AstSerializer.attrs.RENDER}="${AstSerializer.transformTypes.JS}"`, content, this, {
				injectGlobals: true
			});
		});

		// Component cache
		this.componentMapNameToFilePath = {};
		this.components = {};

		this.hashOverrides = {};

		this.globalData = {};

		this.streams = new Streams(["html", "css", "js"]);

		this.fileCache = new FileSystemCache();
	}

	set filePath(value) {
		this._filePath = value;
	}

	get filePath() {
		return this._filePath || AstSerializer.FAKE_FS_PATH;
	}

	static FAKE_FS_PATH = "_webc_raw_input_string";

	static EOL = "\n";

	static prefixes = {
		props: "@",
		dynamic: ":",
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
		ASSET_BUCKET: "webc:bucket", // css scoping
		IF: "webc:if",
		HTML: "@html",
		RAWHTML: "@raw",
		TEXT: "@text",
	};

	static transformTypes = {
		JS: "js",
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

	setBundlerMode(mode) {
		this.bundlerMode = !!mode;
	}

	setAliases(aliases = {}) {
		this.aliases = aliases;
	}

	static getNewLineStartIndeces(content) {
		let lineStarts = [];
		let sum = 0;
		let lineEnding = "\n";
		// this should work okay with \r\n too, \r will just be treated as another character
		for(let line of content.split(lineEnding)) {
			lineStarts.push(sum);
			sum += line.length + lineEnding.length;
		}
		return lineStarts;
	}

	setContent(content) {
		this.content = content;
	}

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

	restorePreparsedComponents(components) {
		Object.assign(this.components, components);
	}

	isVoidElement(tagName) {
		return AstSerializer.voidElements[tagName] || false;
	}

	setUidFunction(fn) {
		this.uidFn = fn;
	}

	getUid() {
		if(this.uidFn && typeof this.uidFn === "function") {
			return this.uidFn();
		}

		return 'webc-' + nanoid(5);
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

	findAllElements(root, tagName) {
		let results = [];
		let rootTagName = this.getTagName(root);
		if(rootTagName === tagName) {
			results.push(root);
		}
		for(let child of root.childNodes || []) {
			for(let node of this.findAllElements(child, tagName)) {
				results.push(node);
			}
		}

		return results;
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

	// Support for `base64url` needs gating e.g. is not available on Stackblitz on Node 16
	// https://github.com/nodejs/node/issues/26512
	getDigest(hash) {
		let prefix = "w";
		let hashLength = 8;
		let digest;
		if(Buffer.isEncoding('base64url')) {
			digest = hash.digest("base64url");
		} else {
			// https://github.com/11ty/eleventy-img/blob/e51ad8e1da4a7e6528f3cc8f4b682972ba402a67/img.js#L343
			digest = hash.digest('base64').replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
		}
		return prefix + digest.toLowerCase().slice(0, hashLength);
	}

	getScopedStyleHash(component, filePath) {
		let hash = createHash("sha256");

		// <style webc:scoped> must be nested at the root
		let styleNodes = this.getTopLevelNodes(component, [], [AstSerializer.attrs.SCOPED]);

		for(let node of styleNodes) {
			let tagName = this.getTagName(node);
			if(tagName !== "style" && !this.isStylesheetNode(tagName, node)) {
				continue;
			}

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

			if(tagName === "style") {
				// hash based on the text content
				// TODO this does *not* process script e.g. <script webc:type="render" webc:is="style" webc:scoped> (see render-css.webc)
				let hashContent = this.getTextContent(node).toString();
				hash.update(hashContent);
			} else { // link stylesheet
				// hash based on the file name
				hash.update(this.getAttributeValue(node, "href"));
			}
		}

		if(styleNodes.length) { // don’t return a hash if empty
			// `base64url` is not available on StackBlitz
			return this.getDigest(hash);
		}
	}

	ignoreComponentParentTag(component) {
		// Has <* webc:root> (has to be a root child, not script/style)
		let tops = this.getTopLevelNodes(component);
		for(let child of tops) {
			let tagName = this.getTagName(child);
			if(tagName === "script" || tagName === "style") {
				continue;
			}

			if(this.hasAttribute(child, AstSerializer.attrs.ROOT)) {
				// ignore if webc:root and webc:keep
				if(this.hasAttribute(child, AstSerializer.attrs.KEEP)) {
					return true;
				}

				// do not ignore if webc:root (but not webc:keep)
				return false;
			}
		}

		// do not ignore if <style> or <script> in component definition (unless <style webc:root> or <script webc:root>)
		for(let child of tops) {
			let tagName = this.getTagName(child);
			if(tagName !== "script" && tagName !== "style" || this.hasAttribute(child, AstSerializer.attrs.ROOT)) {
				continue;
			}

			if(this.hasTextContent(child)) {
				return false;
			}

			// <script src=""> or <link rel="stylesheet" href="">
			if(this.getExternalSource(tagName, child)) {
				return false;
			}
		}


		// Has <template shadowroot> (can be anywhere in the component body)
		let shadowroot = this.findElement(component, "template", ["shadowroot"]);
		if(shadowroot) {
			return false;
		}

		return true;
	}

	// filePath is already cross platform normalized (used by options.closestParentComponent)
	getMode(filePath) {
		return filePath && this.components[filePath] ? this.components[filePath].mode : this.mode;
	}

	// e.g. @html or @text
	isUsingPropBasedContent(node) {
		return this.hasAttribute(node, AstSerializer.attrs.HTML) || this.hasAttribute(node, AstSerializer.attrs.TEXT);
	}

	showInRawMode(node, options) {
		return options.rawMode && !this.hasAttribute(node, AstSerializer.attrs.NOKEEP);
	}

	shouldKeepNode(node) {
		if(this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
			return true;
		}

		return false;
	}

	isTagIgnored(node, component, renderingMode, options) {
		let tagName = this.getTagName(node);

		if(this.shouldKeepNode(node)) {
			return false; // do not ignore
		}

		if(this.hasAttribute(node, AstSerializer.attrs.ROOT)) {
			return true;
		}

		// must come after webc:keep (webc:keep takes precedence)
		if(this.hasAttribute(node, AstSerializer.attrs.NOKEEP)) {
			return true;
		}

		let isBundledTag = this.bundlerMode && (tagName === "style" || tagName === "script" || this.isStylesheetNode(tagName, node));
		if(!isBundledTag && this.isUsingPropBasedContent(node)) {
			return false;
		}

		// Must come after webc:keep (webc:keep takes precedence)
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
		if(isBundledTag) {
			return true;
		}

		return false;
	}

	getImplicitRootNodes(node) {
		return [
			this.findElement(node, "body"),
			this.findElement(node, "head")
		].filter(node => !!node);
	}

	getTopLevelNodes(node, tagNames = [], webcAttrs = []) {
		let roots = this.getImplicitRootNodes(node);
		if(roots.length === 0) {
			throw new Error("Unable to find component root, expected an implicit <head> or <body>");
		}

		let children = [];
		for(let root of roots) {
			for(let child of this.findAllChildren(root, tagNames, webcAttrs)) {
				children.push(child);
			}
		}
		return children;
	}

	getRootAttributes(component, scopedStyleHash) {
		let attrs = [];

		// webc:root Attributes
		let tops = this.getTopLevelNodes(component, [], [AstSerializer.attrs.ROOT]);
		for(let root of tops) {
			for(let attr of root.attrs) {
				if(attr.name !== AstSerializer.attrs.ROOT) {
					attrs.push({ name: attr.name, value: attr.value });
				}
			}
		}

		if(scopedStyleHash) {
			// it’s okay if there are other `class` attributes, we merge them later
			attrs.push({ name: "class", value: scopedStyleHash });
		}

		return attrs;
	}

	async preparseComponentByFilePath(filePath, ast, content) {
		if(this.components[filePath]) {
			// already parsed
			return;
		}

		let isTopLevelComponent = !!ast; // ast is passed in for Top Level components

		// if ast is provided, this is the top level component
		let mode = isTopLevelComponent ? this.mode : "component";

		if(!ast) {
			let parsed = await WebC.getFromFilePath(filePath);
			ast = parsed.ast;
			content = parsed.content;
			mode = parsed.mode;
		}

		let scopedStyleHash = this.getScopedStyleHash(ast, filePath);
		this.components[filePath] = {
			filePath,
			ast,
			content,
			get newLineStartIndeces() {
				if(!this._lineStarts) {
					this._lineStarts = AstSerializer.getNewLineStartIndeces(content);
				}
				return this._lineStarts;
			},
			
			mode,
			ignoreRootTag: this.ignoreComponentParentTag(ast),
			scopedStyleHash,
			rootAttributes: this.getRootAttributes(ast, scopedStyleHash),
			slotTargets: this.getSlotTargets(ast),
		};
	}

	// synchronous (components should already be cached)
	getComponent(name) {
		if(!name || !this.componentMapNameToFilePath[name]) {
			// render as a plain-ol-tag
			return false;
		}

		let filePath = this.componentMapNameToFilePath[name];
		if(!this.components[filePath]) {
			throw new Error(`Component at "${filePath}" not found in the component registry.`);
		}
		return this.components[filePath];
	}

	// `components` object maps from component name => filename
	async setComponentsByFilePath(components = {}) {
		let promises = [];
		for(let name in components) {
			let filePath = components[name];
			this.componentMapNameToFilePath[name] = Path.normalizePath(filePath);

			promises.push(this.preparseComponentByFilePath(this.componentMapNameToFilePath[name]));
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

	getSlotTargets(node) {
		let targetNodes = this.findAllElements(node, "slot");
		let map = {};
		for(let target of targetNodes) {
			let name = this.getAttributeValue(target, "name") || "default";
			map[name] = true;
		}
		return map;
	}

	getSlottedContentNodes(node, defaultSlot = []) {
		let slots = {};

		// Slot definitions must be top level (this matches browser-based Web Components behavior)
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

	async renderStartTag(node, tagName, component, renderingMode, options) {
		let content = "";

		if(!tagName) {
			return { content };
		}

		let attrObject;
		// parse5 doesn’t preserve whitespace around <html>, <head>, and after </body>
		if(renderingMode === "page" && tagName === "head") {
			content += AstSerializer.EOL;
		}

		let attrs = this.getAttributes(node, component, options);
		let parentComponent = this.components[options.closestParentComponent];

		// webc:keep webc:root should use the style hash class name and host attributes since they won’t be added to the host component
		if(parentComponent && parentComponent.ignoreRootTag && this.hasAttribute(node, AstSerializer.attrs.ROOT) && this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
			if(parentComponent.scopedStyleHash) {
				attrs.push({ name: "class", value: parentComponent.scopedStyleHash });
			}
			for(let hostAttr of options.hostComponentNode?.attrs || []) {
				attrs.push(hostAttr);
			}
		}

		attrObject = AttributeSerializer.dedupeAttributes(attrs);

		if(options.isMatchingSlotSource) {
			delete attrObject.slot;
		}

		let nodeData = Object.assign({}, this.helpers, options.componentProps, options.hostComponentData, this.globalData);
		if(this.showInRawMode(node, options) || !this.isTagIgnored(node, component, renderingMode, options)) {
			content += `<${tagName}${await AttributeSerializer.getString(attrObject, nodeData)}>`;
		}

		return {
			content,
			attrs: attrObject,
			nodeData,
		};
	}

	renderEndTag(node, tagName, component, renderingMode, options) {
		let content = "";
		if(tagName) {
			if(this.isVoidElement(tagName)) {
				// do nothing: void elements don’t have closing tags
			} else if(this.showInRawMode(node, options) || !this.isTagIgnored(node, component, renderingMode, options)) {
				content += `</${tagName}>`;
			}

			if(renderingMode === "page" && tagName === "body") {
				content += AstSerializer.EOL;
			}
		}
		return content;
	}

	async transformContent(content, transformTypes, node, parentComponent, slots, options) {
		if(!transformTypes) {
			transformTypes = [];
		}

		let slotsText = {}
		if(slots && slots.default) {
			let o = Object.assign({}, options);
			delete o.currentTransformTypes;
			o.useHostComponentMarkup = true;

			slotsText.default = this.getPreparsedRawTextContent(o.hostComponentNode, o);
		}

		let context = {
			filePath: this.filePath,
			helpers: this.helpers,
			slots: {
				text: slotsText,
			},
			...this.globalData,
			...AttributeSerializer.dedupeAttributes(node.attrs),
			...options.componentProps,
		};

		for(let type of transformTypes) {
			content = await this.transforms[type].call({
				type,
				...context
			}, content, parentComponent);
		}

		return content;
	}

	async importComponent(filePath, relativeFromOverride, tagName = "") {
		if(!this.filePath) {
			throw new Error("Dynamic component import requires a filePath to be set.")
		}

		let resolver = new ModuleResolution();
		resolver.setTagName(tagName);
		resolver.setAliases(this.aliases)

		let relativeFrom;
		// aliased imports are relative to the project root
		if(resolver.hasValidAlias(filePath)) {
			relativeFrom = ".";
		} else {
			// webc:import is relative to the component file!
			let parsed = path.parse(relativeFromOverride || this.filePath);
			relativeFrom = parsed.dir;
		}

		let resolvedPath = resolver.resolve(filePath);
		let relativeFromRoot = path.join(relativeFrom, resolvedPath);
		let finalFilePath = Path.normalizePath(relativeFromRoot);
		await this.preparseComponentByFilePath(finalFilePath);

		return this.components[finalFilePath];
	}

	/**
	 * @param {String} slotName
	 * @param {Slots} slots
	 * @param {Node} node
	 * @param {CompileOptions} options
	 * @returns {Promise<string>}
	 * @private
	 */
	 async getContentForNamedSlot(slotName, slots, node, options) {
		slotName = slotName || "default";

		let slotAst = slots[slotName];
		if(
			(typeof slotAst === "object" && slotAst.childNodes?.length > 0) || // might be a childNodes: []
			(typeof slotAst !== "object" && slotAst) || // might be a string
			slotName !== "default"
		) {
			if(typeof slotAst === "string") {
				slotAst = await WebC.getASTFromString(slotAst);
			}

			// not found in slots object
			if(!slotAst && slotName !== "default") {
				let { html: mismatchedSlotHtml } = await this.getChildContent(node, slots, options, true);
				return mismatchedSlotHtml;
			}

			let { html: slotHtml } = await this.compileNode(slotAst, slots, options, true);
			return slotHtml;
		}

		// Use light dom fallback content in <slot> if no slot source exists to fill it
		let { html: slotFallbackHtml } = await this.getChildContent(node, null, options, true);
		return slotFallbackHtml;
	}

	/**
	 * @param {Node} node
	 * @param {Slots} slots
	 * @param {CompileOptions} options
	 * @returns {Promise<string>}
	 * @private
	 */
	async getContentForSlot(node, slots, options) {
		let slotName = this.getAttributeValue(node, "name");
		return this.getContentForNamedSlot(slotName, slots, node, options);
	}

	/**
	 * @param {Template} node
	 * @param {Slots} slots
	 * @param {CompileOptions} options
	 * @returns {Promise<string>}
	 * @private
	 */
	async getContentForTemplate(node, slots, options) {
		if(!node.content) {
			throw new Error(`Invalid node passed to getContentForTemplate: must be a <template> with a \`content\` property. Received: ${node.nodeName}.`);
		}

		let rawContent;
		// <template webc:raw> or <template webc:type> for transformin’
		if(this.hasAttribute(node, AstSerializer.attrs.RAW) || this.hasAttribute(node, AstSerializer.attrs.TYPE)) {
			rawContent = this.getPreparsedRawTextContent(node, options);
		} else {
			let templateOptions = Object.assign({}, options);

			// Processes `<template webc:root>` as WebC (including slot resolution)
			// Processes `<template>` in raw mode (for plain template, shadowroots, webc:keep, etc).
			if(!this.hasAttribute(node, AstSerializer.attrs.ROOT)) {
				templateOptions.rawMode = true;
			}

			// No transformation on this content during first compilation
			delete templateOptions.currentTransformTypes;
	
			let { html } = await this.compileNode(node.content, slots, templateOptions, false);
			rawContent= html;
		}

		if(!options.currentTransformTypes || options.currentTransformTypes.length === 0) {
			return rawContent;
		}

		return this.transformContent(rawContent, options.currentTransformTypes, node, this.components[options.closestParentComponent], slots, options);
	}

	/**
	 * Compiles (reprocesses, issue #33) content returned from <template> or <* webc:is="template"> text nodes as WebC.
	 *
	 * @param {String} rawContent
	 * @param {Slots} slots
	 * @param {CompileOptions} options
	 * @returns {Promise<string>}
	 * @private
	 */
	async compileString(rawContent, node, slots, options) {
		if(typeof rawContent !== "string") {
			rawContent = `${rawContent}`;
		}

		// Short circuit if rawContent has no < for tags
		if(this.hasAttribute(node, AstSerializer.attrs.RAW) || !rawContent.includes("<")) {
			return rawContent;
		}

		// Constructs an AST out of the string returned from the render function
		let renderFunctionAst = await WebC.getASTFromString(rawContent);

		options.renderingModeOverride = "component";
		options.rawMode = false;

		// no further transforms
		delete options.currentTransformTypes;

		// Passes the AST back to `compileNode` which can handle the rest
		let { html: renderFunctionHtml } = await this.compileNode(renderFunctionAst, slots, options, false);

		// Note that asset buckets are passed through options
		return renderFunctionHtml;
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

		// Always last
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
			if(!options.isSlottedContent) {
				if(options.closestParentComponent === componentFilePath || options.components.dependantsOf(options.closestParentComponent).find(entry => entry === componentFilePath) !== undefined) {
					throw new Error(`Circular dependency error: You cannot use <${tagName}> inside the definition for ${options.closestParentComponent}`);
				}
			}

			options.components.addDependency(options.closestParentComponent, componentFilePath);
		}

		// save the previous
		options.hostComponentContextFilePath = options.closestParentComponent;

		// reset for next time
		options.closestParentComponent = Path.normalizePath(componentFilePath);
	}

	isStylesheetNode(tagName, node) {
		return tagName === "link" && this.getAttributeValue(node, "rel") === "stylesheet";
	}

	getAggregateAssetKey(tagName, node) {
		if(!this.bundlerMode) {
			return false;
		}

		if(tagName === "style" || this.isStylesheetNode(tagName, node)) {
			return "css";
		}

		if(tagName === "script") {
			return "js"
		}
	}

	getBucketName(node) {
		let bucket = this.getAttributeValue(node, AstSerializer.attrs.ASSET_BUCKET);
		if(bucket) {
			return bucket;
		}

		return "default";
	}

	getExternalSource(tagName, node) {
		if(this.isStylesheetNode(tagName, node)) {
			return this.getAttributeValue(node, "href");
		}

		if(tagName === "script") {
			return this.getAttributeValue(node, "src");
		}
	}

	/* Depth-first list, not dependency-graph ordered.
	 * This is in contrast to `components` returned from compile methods *are* dependency-graph ordered.
	 * Also note this is overly permissive (includes components in unused slots).
	 * Also includes external <script src> and <link rel="stylesheet" href> sources here too.
	 * This method is used for incremental static builds.
	 */
	getComponentList(node, rawMode = false, closestComponentFilePath) {
		let components = {};

		if(rawMode) {
			return components;
		}

		if(this.filePath) {
			components[this.filePath] = true;
		}

		if(this.hasAttribute(node, AstSerializer.attrs.RAW)) {
			rawMode = true;
		}

		let tagName = this.getTagName(node);
		let externalSource = this.getExternalSource(tagName, node);
		if(externalSource) {
			let p = FileSystemCache.getRelativeFilePath(externalSource, closestComponentFilePath);
			components[Path.normalizePath(p)] = true;
		}

		let importSource = Path.normalizePath(this.getAttributeValue(node, AstSerializer.attrs.IMPORT));
		if(importSource) {
			// TODO also relative-to-closest-component paths here? via FileSystemCache.getRelativeFilePath (and below in compileNode)
			components[importSource] = true;
			closestComponentFilePath = importSource;

			if(this.components[importSource]) {
				Object.assign(components, this.getComponentList(this.components[importSource].ast, rawMode, importSource));
			}
		} else {
			let filePath = Path.normalizePath(this.componentMapNameToFilePath[tagName]);
			if(filePath) {
				// TODO also relative-to-closest-component paths here? via FileSystemCache.getRelativeFilePath (and below in compileNode)
				components[filePath] = true;
				closestComponentFilePath = filePath;

				if(this.components[filePath]) {
					Object.assign(components, this.getComponentList(this.components[filePath].ast, rawMode, filePath));
				}
			}
		}

		for(let child of (node.childNodes || [])) {
			Object.assign(components, this.getComponentList(child, rawMode || tagName === "template", closestComponentFilePath));
		}

		return components;
	}

	isUnescapedTagContent(parentNode) {
		let tagName = parentNode?.tagName;
		if(tagName === "style" || tagName === "script" || tagName === "noscript" || tagName === "template") {
			return true;
		}
		return false;
	}

	// Used for @html and webc:if
	async evaluateAttribute(name, attrContent, options) {
		let data = Object.assign({}, this.helpers, options.componentProps, this.globalData);
		let content = await ModuleScript.evaluateScript(name, attrContent, data, {
			filePath: options.closestParentComponent || this.filePath
		});
		return content;
	}

	// @html or @text or @raw
	async getPropContentAst(node, slots, options) {
		let htmlProp = this.getAttributeValue(node, AstSerializer.attrs.HTML);
		let textProp = this.getAttributeValue(node, AstSerializer.attrs.TEXT);
		let rawProp = this.getAttributeValue(node, AstSerializer.attrs.RAWHTML);

		if([htmlProp, textProp, rawProp].filter(entry => !!entry).length > 1) {
			let tagName = this.getTagName(node);
			throw new Error(`Node ${tagName} cannot have more than one @html${htmlProp ? `="${htmlProp}"` : ""}, @text${textProp ? `="${textProp}"` : ""}, or @raw${rawProp ? `="${rawProp}"` : ""} properties. Pick one!`);
		}

		let propContent = htmlProp || textProp || rawProp;
		if(!propContent) {
			return false;
		}

		let content = await this.evaluateAttribute(AstSerializer.attrs.HTML, propContent, options);

		if(typeof content !== "string") {
			content = `${content || ""}`;
		}

		if(rawProp) {
			// do nothing
		} else if(htmlProp) {
			// Reprocess content
			content = await this.compileString(content, node, slots, options);
		} else if(textProp) {
			content = escapeText(content);
		}

		return {
			nodeName: "#text",
			value: content,
			_webCProcessed: true,
		};
	}

	// Requires parse5’s sourceLocationInfo option to be set to true
	getPreparsedRawTextContent(node, options) {
		if(!node.sourceCodeLocation) {
			throw new Error("`getPreparsedRawTextContent` requires `parse5->parse->sourceLocationInfo: true`. This is a WebC error that needs to be filed on the issue tracker: https://github.com/11ty/webc/issues/");
		}

		// if void element, fallback to the node’s sourceCodeLocation (issue #67)
		let start = node.sourceCodeLocation.startTag || node.sourceCodeLocation;
		let end = node.sourceCodeLocation.endTag || node.sourceCodeLocation;

		// Skip out early if the component has no content (not even whitespace)
		// TODO possible improvement to use `hasTextContent` to ignore whitespace only children
		//      Would we ever want to use webc:raw to output just whitespace?
		if(start.endLine === end.startLine && start.endCol === end.startCol) {
			return "";
		}

		let {closestParentComponent} = options;

		// The template resides in the host component child content
		if(options.useHostComponentMarkup && options.hostComponentContextFilePath) {
			closestParentComponent = options.hostComponentContextFilePath;
		}

		let {newLineStartIndeces, content} = this.components[closestParentComponent];
		let startIndex = newLineStartIndeces[start.endLine - 1] + start.endCol - 1;
		let endIndex = newLineStartIndeces[end.startLine - 1] + end.startCol - 1;

		let rawContent = content.slice(startIndex, endIndex);

		if(os.EOL !== AstSerializer.EOL) {
			// Use replaceAll(os.EOL) when we drop support for Node 14 (see node.green)
			return rawContent.replace(/\r\n/g, AstSerializer.EOL);
		}

		return rawContent;
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

		let renderingMode = options.renderingModeOverride || this.getMode(options.closestParentComponent);

		// Short circuit for text nodes, comments, doctypes
		if(node.nodeName === "#text") {
			// Should we use getPreparsedRawTextContent here instead? My hunch is that node.value is okay for now
			let c = node.value;

			// Run transforms
			if(options.currentTransformTypes && options.currentTransformTypes.length > 0) {
				c = await this.transformContent(node.value, options.currentTransformTypes, node, this.components[options.closestParentComponent], slots, options);

				// only reprocess text nodes in a <* webc:is="template" webc:type>
				if(!node._webCProcessed && node.parentNode && this.getTagName(node.parentNode) === "template") {
					c = await this.compileString(c, node.parentNode, slots, options);
				}
			}

			let unescaped = this.outputHtml(c, streamEnabled);
			if(options.rawMode || this.isUnescapedTagContent(node.parentNode)) {
				return { html: unescaped };
			} else {
				// via https://github.com/inikulin/parse5/blob/159ef28fb287665b118c71e1c5c65aba58979e40/packages/parse5-html-rewriting-stream/lib/index.ts
				return { html: escapeText(unescaped) };
			}
		} else if(node.nodeName === "#comment") {
			return {
				html: this.outputHtml(`<!--${node.data}-->`, streamEnabled)
			};
		} else if(renderingMode === "page" && node.nodeName === "#documentType") {
			return {
				html: this.outputHtml(`<!doctype ${node.name}>${AstSerializer.EOL}`, streamEnabled)
			};
		}

		let component;
		let importSource = this.getAttributeValue(node, AstSerializer.attrs.IMPORT);
		if(importSource) {
			component = await this.importComponent(importSource, options.closestParentComponent, tagName);
		} else {
			component = this.getComponent(tagName);
		}

		if(component) {
			options.closestParentUid = this.getUid();
			// we need to set this so that the props of the host component are evaluated with the webc:root attributes inside the component definition
			options.componentProps = {
				uid: options.closestParentUid
			};
		}

		let ifExprContent = this.getAttributeValue(node, AstSerializer.attrs.IF);
		if(ifExprContent) {
			let ifExprValue = await this.evaluateAttribute(AstSerializer.attrs.IF, ifExprContent, options);
			if(!ifExprValue) {
				return { html: "" };
			}
		}

		let slotSource = this.getAttributeValue(node, "slot");
		if(!options.rawMode && options.closestParentComponent) {
			if(slotSource && options.isSlottedContent) {
				let slotTargets = this.components[options.closestParentComponent].slotTargets;
				if(slotTargets[slotSource]) {
					options.isMatchingSlotSource = true;
				}
			}
		}

		// TODO warning if top level page component using a style hash but has no root element (text only?)

		// Start tag
		let { content: startTagContent, attrs, nodeData } = await this.renderStartTag(node, tagName, component, renderingMode, options);
		content += this.outputHtml(startTagContent, streamEnabled);

		if(component) {
			options.componentProps = await AttributeSerializer.normalizeAttributesForData(attrs, nodeData);
			options.componentProps.uid = options.closestParentUid;
		}

		// @html and @text are aliases for default slot content when used on a host component
		let componentHasContent = null;
		let defaultSlotNodes = [];

		let propContentNode = await this.getPropContentAst(node, slots, options);
		let assetKey = this.getAggregateAssetKey(tagName, node);
		if(propContentNode !== false) {
			if(!options.rawMode && component) {
				// Fake AST text node
				defaultSlotNodes.push(propContentNode);
			} else if(assetKey) { // assets for aggregation
				if(!node.childNodes) {
					node.childNodes = [];
				}

				// remove any already added nodes
				node.childNodes = node.childNodes.filter(entry => {
					return !entry._webCProcessed;
				});

				// WARNING: side effects (filtered above)
				node.childNodes.push(propContentNode);
			} else {
				componentHasContent = propContentNode.value.trim().length > 0;
				content += propContentNode.value;
			}
		}

		// Component content (foreshadow dom)
		if(!options.rawMode && component) {
			this.addComponentDependency(component, tagName, options);

			options.hostComponentNode = node;
			options.hostComponentData = AttributeSerializer.convertAttributesToDataObject(node.attrs);

			let slots = this.getSlottedContentNodes(node, defaultSlotNodes);
			let { html: foreshadowDom } = await this.compileNode(component.ast, slots, options, streamEnabled);
			componentHasContent = foreshadowDom.trim().length > 0;
			content += foreshadowDom;
		}

		// Skip the remaining content if we have foreshadow dom!
		if(!componentHasContent) {
			let externalSource = this.getExternalSource(tagName, node);

			if(!options.rawMode && tagName === "slot") { // <slot> node
				options.isSlottedContent = true;

				content += await this.getContentForSlot(node, slots, options);
			} else if(node.content) {
				let c = await this.getContentForTemplate(node, slots, options);

				if(transformTypes.length > 0 && !node._webCProcessed) { // reprocess <template webc:type>
					c = await this.compileString(c, node, slots, options);
				}

				content += this.outputHtml(c, streamEnabled);
			} else if(node.childNodes?.length > 0 || externalSource) {
				// Fallback to light DOM if no component dom exists (default slot content)
				if(componentHasContent === false) {
					options.isSlottedContent = true;
				}

				if(options.rawMode) {
					let { html: childContent } = await this.getChildContent(node, slots, options, streamEnabled);
					content += childContent;
				} else if(tagName === "template" && options.currentTransformTypes) {
					let { html: childContent } = await this.getChildContent(node, slots, options, false);
					content += this.outputHtml(childContent, streamEnabled);
				} else {
					// Aggregate to CSS/JS bundles, ignore if webc:keep
					if(assetKey && !this.shouldKeepNode(node)) {
						let childContent;
						if(externalSource) { // fetch file contents, note that child content is ignored here
							// TODO make sure this isn’t already in the asset aggregation bucket *before* we read.

							let fileContent = this.fileCache.read(externalSource, options.closestParentComponent || this.filePath);
							childContent = await this.transformContent(fileContent, options.currentTransformTypes, node, this.components[options.closestParentComponent], slots, options);
						} else {
							let { html } = await this.getChildContent(node, slots, options, false);
							childContent = html;
						}

						let bucket = this.getBucketName(node);
						if(bucket !== "default") {
							if(!options.assets.buckets[assetKey]) {
								options.assets.buckets[assetKey] = new Set();
							}
							options.assets.buckets[assetKey].add(bucket);
						}

						let entryKey = options.closestParentComponent || this.filePath;
						if(!options.assets[assetKey][entryKey]) {
							options.assets[assetKey][entryKey] = {};
						}
						if(!options.assets[assetKey][entryKey][bucket]) {
							options.assets[assetKey][entryKey][bucket] = new Set();
						}
						if(!options.assets[assetKey][entryKey][bucket].has(childContent)) {
							options.assets[assetKey][entryKey][bucket].add( childContent );

							// TODO should this entire branch be skipped and assets should always leave as-is when streaming?
							this.streams.output(assetKey, childContent);
						}

					} else { // Otherwise, leave as-is
						let { html: childContent } = await this.getChildContent(node, slots, options, streamEnabled);
						content += childContent;
					}
				}
			}
		}

		// End tag
		content += this.outputHtml(await this.renderEndTag(node, tagName, component, renderingMode, options), streamEnabled);

		return {
			html: content,
		}
	}

	async compile(node, slots = {}, options = {}) {
		options = Object.assign({
			rawMode: false, // plaintext output
			isSlottedContent: false,
			isMatchingSlotSource: false,
			assets: {
				buckets: {},
				css: {},
				js: {},
			},
			components: new DepGraph({ circular: true }),
			closestParentComponent: this.filePath,
			closestParentUid: this.getUid(),
		}, options);

		// parse the top level component
		if(!this.components[this.filePath]) {
			await this.preparseComponentByFilePath(this.filePath, node, this.content);
		}

		options.components.addNode(this.filePath);
		options.componentProps = {
			uid: options.closestParentUid
		};

		try {
			if(node.mode === "quirks") {
				throw new Error(`Quirks mode rendering encountered${this.filePath ? ` for ${this.filePath}` : ""}. A <!doctype html> declaration *is* optional—did you specify a different doctype?`)
			}

			let compiled = await this.compileNode(node, slots, options);
			let content = compiled.html;
			let assets = new AssetManager(options.components);

			let returnObject = {
				html: content,
				components: assets.orderedComponentList.filter(entry => entry !== AstSerializer.FAKE_FS_PATH),
				css: [],
				js: [],
				buckets: {},
			};

			if(this.bundlerMode) {
				returnObject.css = assets.getOrderedAssets(options.assets.css);
				returnObject.js = assets.getOrderedAssets(options.assets.js);

				for(let type in options.assets.buckets) {
					returnObject.buckets[type] = {};

					for(let bucket of options.assets.buckets[type]) {
						returnObject.buckets[type][bucket] = assets.getOrderedAssets(options.assets[type], bucket);
					}
				}
			}

			return returnObject;
		} catch(e) {
			this.streams.error("html", e);
			return Promise.reject(e);
		}
	}
}

export { AstSerializer };
