import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import { DepGraph } from "dependency-graph";

import { WebC } from "../webc.js";
import { Path } from "./path.js";
import { AssetManager } from "./assetManager.js";
import { CssPrefixer } from "./css.js";
import { AttributeSerializer } from "./attributeSerializer.js";
import { ModuleScript } from "./moduleScript.js";
import { Streams } from "./streams.js";
import { escapeText } from 'entities/lib/escape.js';

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

		// transform scoped CSS with a hash prefix
		this.setTransform(AstSerializer.transformTypes.SCOPED, (content, component) => {
			let prefixer = new CssPrefixer(component.scopedStyleHash);
			prefixer.setFilePath(component.filePath);
			return prefixer.process(content);
		});

		this.setTransform(AstSerializer.transformTypes.RENDER, async function(content) {
			let fn = ModuleScript.getModule(content, this.filePath);
			return fn.call(this);
		});

		// Component cache
		this.componentMap = {};
		this.components = {};

		this.hashOverrides = {};

		this.globalData = {};

		this.streams = new Streams(["html", "css", "js"]);

		this.fileCache = new FileSystemCache();
	}

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

	setBundlerMode(mode) {
		this.bundlerMode = !!mode;
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

	getScopedStyleHash(component, filePath) {
		let prefix = "w";
		let hashLength = 8;
		let hash = createHash("sha256");

		// <style webc:scoped> must be nested at the root
		let styleNodes = this.getTopLevelNodes(component, ["style"], [AstSerializer.attrs.SCOPED]);

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

	isTagIgnored(node, component, renderingMode, options = {}) {
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
		if(this.bundlerMode) {
			if(tagName === "style" || tagName === "script" || this.isStylesheetNode(tagName, node)) {
				return true;
			}
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
					attrs.push(attr);
				}
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
			// already parsed
			return;
		}

		let isTopLevelComponent = !!ast; // ast is passed in for Top Level components

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
			slotTargets: this.getSlotTargets(ast),
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

	getSlotTargets(node) {
		let targetNodes = this.findAllElements(node, "slot");
		let map = {};
		for(let target of targetNodes) {
			let name = this.getAttributeValue(target, "name") || "default";
			map[name] = true;
		}
		return map;
	}

	getSlottedContentNodes(node) {
		let slots = {};
		let defaultSlot = [];
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

	renderStartTag(node, tagName, component, renderingMode, options) {
		let content = "";
		let attrObject;

		if(tagName) {
			// parse5 doesn’t preserve whitespace around <html>, <head>, and after </body>
			if(renderingMode === "page" && tagName === "head") {
				content += `\n`;
			}

			let attrs = this.getAttributes(node, component, options);
			// webc:keep webc:root should use the style hash class name and host attributes since they won’t be added to the host component
			let parentComponent = this.components[options.closestParentComponent];
			if(parentComponent && parentComponent.ignoreRootTag && this.hasAttribute(node, AstSerializer.attrs.ROOT) && this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
				if(parentComponent.scopedStyleHash) {
					attrs.push({ name: "class", value: parentComponent.scopedStyleHash });
				}

				for(let hostAttr of options.hostComponentNode.attrs) {
					attrs.push(hostAttr);
				}
			}
			attrObject = AttributeSerializer.dedupeAttributes(attrs);

			if(options.isMatchingSlotSource) {
				delete attrObject.slot;
			}

			if(options.rawMode || !this.isTagIgnored(node, component, renderingMode, options)) {
				content += `<${tagName}${AttributeSerializer.getString(attrObject, options.componentProps, this.globalData)}>`;
			}
		}

		return {
			content,
			attrs: attrObject
		};
	}

	renderEndTag(node, tagName, component, renderingMode, options) {
		let content = "";
		if(tagName) {
			if(this.isVoidElement(tagName)) {
				// do nothing: void elements don’t have closing tags
			} else if(options.rawMode || !this.isTagIgnored(node, component, renderingMode, options)) {
				content += `</${tagName}>`;
			}

			if(renderingMode === "page" && tagName === "body") {
				content += `\n`;
			}
		}
		return content;
	}

	async transformContent(content, transformTypes, node, parentComponent, options) {
		if(!transformTypes) {
			transformTypes = [];
		}

		let context = {
			filePath: this.filePath,
			helpers: this.helpers,
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
		if(slots[slotName] || slotName !== "default") {
			let slotAst = slots[slotName];
			if(typeof slotAst === "string") {
				slotAst = await WebC.getASTFromString(slotAst);
			}

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

	async getContentForTemplate(node, slots, options) {
		let templateOptions = Object.assign({}, options);
		templateOptions.rawMode = true;
		// no transformation on this content
		delete templateOptions.currentTransformTypes;

		let { html: rawContent } = await this.compileNode(node.content, slots, templateOptions, false);
		// Get plaintext from <template> .content
		if(options.currentTransformTypes) {
			return this.transformContent(rawContent, options.currentTransformTypes, node, this.components[options.closestParentComponent], options);
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

		// reset for next time
		options.closestParentComponent = Path.normalizePath(componentFilePath);
	}

	isStylesheetNode(tagName, node) {
		return tagName === "link" && this.getAttributeValue(node, "rel") === "stylesheet";
	}

	getAggregateAssetKey(tagName, node) {
		if(!this.bundlerMode || this.hasAttribute(node, AstSerializer.attrs.KEEP)) {
			return false;
		}

		if(tagName === "style" || this.isStylesheetNode(tagName, node)) {
			return "css";
		}

		if(tagName === "script") {
			return "js"
		}
	}

	getBucketName(node, tagName) {
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
			let filePath = Path.normalizePath(this.componentMap[tagName]);
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
				let unescaped = this.outputHtml(node.value, streamEnabled);
				if(options.rawMode || this.isUnescapedTagContent(node.parentNode)) {
					content += unescaped;
				} else {
					// via https://github.com/inikulin/parse5/blob/159ef28fb287665b118c71e1c5c65aba58979e40/packages/parse5-html-rewriting-stream/lib/index.ts
					content += escapeText(unescaped);
				}
			} else {
				content += this.outputHtml(await this.transformContent(node.value, options.currentTransformTypes, node, this.components[options.closestParentComponent], options), streamEnabled);
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
		let { content: startTagContent, attrs } = await this.renderStartTag(node, tagName, component, renderingMode, options);
		content += this.outputHtml(startTagContent, streamEnabled);

		if(component) {
			options.componentProps = AttributeSerializer.removePropsPrefixesFromAttributes(attrs);
		}

		// Component content (foreshadow dom)
		let componentHasContent = null;
		let htmlAttribute = this.getAttributeValue(node, AstSerializer.attrs.HTML);
		if(htmlAttribute) {
			let fn = ModuleScript.evaluateAsyncAttribute(htmlAttribute);
			let context = Object.assign({}, this.helpers, options.componentProps, this.globalData);
			let htmlContent = await fn.call(context);
			componentHasContent = htmlContent.trim().length > 0;
			content += htmlContent;
		} else if(!options.rawMode && component) {
			this.addComponentDependency(component, tagName, options);
			options.hostComponentNode = node;

			let slots = this.getSlottedContentNodes(node);
			let { html: foreshadowDom } = await this.compileNode(component.ast, slots, options, streamEnabled);
			componentHasContent = foreshadowDom.trim().length > 0;
			content += foreshadowDom;
		}
		
		// Skip the remaining content is we have foreshadow dom!
		if(!componentHasContent) {
			let externalSource = this.getExternalSource(tagName, node);

			if(!options.rawMode && tagName === "slot") { // <slot> node
				options.isSlottedContent = true;

				content += await this.getContentForSlot(node, slots, options);
			} else if(node.content) { // <template> content
				content += this.outputHtml(await this.getContentForTemplate(node, slots, options), streamEnabled);
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
					let key = this.getAggregateAssetKey(tagName, node, options);

					// Aggregate to CSS/JS bundles
					if(key) {
						let childContent;
						if(externalSource) { // fetch file contents, note that child content is ignored here
							// TODO make sure this isn’t already in the asset aggregation bucket *before* we read.
							childContent = this.fileCache.read(externalSource, options.closestParentComponent || this.filePath);
						} else {
							let { html } = await this.getChildContent(node, slots, options, false);
							childContent = html;
						}

						let bucket = this.getBucketName(node, tagName);
						if(bucket !== "default") {
							if(!options.assets.buckets[key]) {
								options.assets.buckets[key] = new Set();
							}
							options.assets.buckets[key].add(bucket);
						}

						let entryKey = options.closestParentComponent || this.filePath;
						if(!options.assets[key][entryKey]) {
							options.assets[key][entryKey] = {};
						}
						if(!options.assets[key][entryKey][bucket]) {
							options.assets[key][entryKey][bucket] = new Set();
						}
						if(!options.assets[key][entryKey][bucket].has(childContent)) {
							options.assets[key][entryKey][bucket].add( childContent );

							// TODO should this entire branch be skipped and assets should always leave as-is when streaming?
							this.streams.output(key, childContent);
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

			let returnObject = {
				html: content,
				components: assets.orderedComponentList,
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