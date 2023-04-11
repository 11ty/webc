import path from "path";
import os from "os";
import { DepGraph } from "dependency-graph";

import { WebC } from "../webc.js";
import { Path } from "./path.js";
import { AstQuery } from "./astQuery.js";
import { AssetManager } from "./assetManager.js";
import { CssPrefixer } from "./css.js";
import { Looping } from "./looping.js";
import { AttributeSerializer } from "./attributeSerializer.js";
import { ModuleScript } from "./moduleScript.cjs";
import { Streams } from "./streams.js";
import { escapeText, escapeAttribute } from "entities/lib/escape.js";
import { nanoid } from "nanoid";
import { ModuleResolution } from "./moduleResolution.js";
import { FileSystemCache } from "./fsCache.js";
import { DataCascade } from "./dataCascade.js";
import { ComponentManager } from "./componentManager.js";
import { Util } from "./util.js";

/** @typedef {import('parse5/dist/tree-adapters/default').Node} Node */
/** @typedef {import('parse5/dist/tree-adapters/default').Template} Template */
/** @typedef {import('parse5/dist/tree-adapters/default').TextNode} TextNode */
/** @typedef {{ [key: string]: Node | undefined, default?: Node | undefined }} Slots */
/**
 * @typedef {object} CompileOptions
 * @property {boolean} rawMode
 * @property {boolean} isSlottableContent
 * @property {boolean} isMatchingSlotSource
 * @property {string} closestParentComponent
 * @property {string} closestParentUid
 * @property {{ buckets: { [key: string]: Set<string> }, css: any, js: any }} assets
 * @property {DepGraph<any>} components
 * @property {{ uid: string }} [componentProps]
 * @property {Array<"render" | "css:scoped">} [currentTransformTypes]
 */

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

		this.setTransform(AstSerializer.transformTypes.JS, async function(content) {
			// returns promise
			let { returns } = await ModuleScript.evaluateScript(content, this, `Check the webc:type="js" element in ${this.filePath}.`);
			return returns;
		});

		// Component cache
		this.componentMapNameToFilePath = {};

		this.streams = new Streams(["html", "css", "js"]);

		this.fileCache = new FileSystemCache();

		this.dataCascade = new DataCascade();

		// Helpers/global variables for WebC things
		this.dataCascade.setWebCGlobals({
			renderAttributes: (attributesObject) => {
				return AttributeSerializer.getString(attributesObject);
			},
			filterPublicAttributes: (attributesObject) => {
				return AttributeSerializer.getPublicAttributesAsObject(attributesObject);
			},
			escapeText: escapeText,
			escapeAttribute: escapeAttribute,
		});
	}

	get componentManager() {
		if(!this._componentManager) {
			this._componentManager = new ComponentManager();
		}
		return this._componentManager;
	}

	setComponentManager(manager) {
		if(manager) {
			this._componentManager = manager;
		}
	}

	set filePath(value) {
		this._filePath = value;
	}

	get filePath() {
		return this._filePath || AstSerializer.FAKE_FS_PATH;
	}

	static FAKE_FS_PATH = "_webc_raw_input_string";

	static EOL = "\n";

	/* Custom HTML attributes */
	static attrs = {
		TYPE: "webc:type",
		KEEP: "webc:keep",
		NOKEEP: "webc:nokeep",
		RAW: "webc:raw",
		NOBUNDLE: "webc:nobundle",
		IS: "webc:is",
		ROOT: "webc:root",
		IMPORT: "webc:import", // import another webc inline
		SCOPED: "webc:scoped", // css scoping
		ASSET_BUCKET: "webc:bucket", // css scoping
		HTML: "@html",
		RAWHTML: "@raw",
		TEXT: "@text",
		ATTRIBUTES: "@attributes",
		SETUP: "webc:setup",
		IGNORE: "webc:ignore", // ignore the node
		IF: "webc:if",
		ELSE: "webc:else",
		ELSEIF: "webc:elseif",
		LOOP: "webc:for",
	};

	static transformTypes = {
		JS: "js",
		RENDER: "render",
		SCOPED: "css:scoped",
	};

	setBundlerMode(mode) {
		this.bundlerMode = !!mode;
	}

	setAliases(aliases = {}) {
		this.aliases = aliases;
	}

	setContent(content) {
		this.content = content;
	}

	setMode(mode = "component") {
		this.mode = mode; // "page" or "component"
	}

	setTransform(name, callback) {
		this.transforms[name] = callback;
	}

	// helper functions are used in @html and render functions
	// TODO lookup attributes too?
	setHelper(name, callback, isScoped) {
		this.dataCascade.setHelper(name, callback, isScoped);
	}

	setData(data = {}) {
		this.dataCascade.setGlobalData(data);
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

	static setUid(obj, uid) {
		if(uid) {
			obj.uid = uid;
			AttributeSerializer.setKeyPrivacy(obj, "uid", "private");
		}
	}

	// filePath is already cross platform normalized (used by options.closestParentComponent)
	getMode(filePath) {
		return filePath && this.componentManager.has(filePath) ? this.componentManager.get(filePath).mode : this.mode;
	}

	// e.g. @html or @text
	isUsingPropBasedContent(node) {
		return AstQuery.hasAttribute(node, AstSerializer.attrs.HTML) || AstQuery.hasAttribute(node, AstSerializer.attrs.TEXT);
	}

	showInRawMode(node, options) {
		return options.rawMode && !AstQuery.hasAttribute(node, AstSerializer.attrs.NOKEEP);
	}

	shouldKeepNode(node) {
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.KEEP)) {
			return true;
		}

		return false;
	}

	isBundledTag(node, tagName, options) {
		if(!tagName) {
			tagName = AstQuery.getTagName(node);
		}
		if(options.skipBundle) {
			return false;
		}
		return this.bundlerMode && (tagName === "style" || AstQuery.isScriptNode(tagName, node) || AstQuery.isLinkStylesheetNode(tagName, node));
	}

	isTagIgnored(node, component, renderingMode, options) {
		let tagName = AstQuery.getTagName(node);

		if(this.shouldKeepNode(node)) { // webc:keep
			return false; // do not ignore
		}

		// must come after webc:keep (webc:keep takes precedence)
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.NOKEEP)) {
			return true;
		}

		if(AstQuery.getRootNodeMode(node) === "merge") { // has webc:root but is not webc:root="override"
			return true;
		}

		let isBundledTag = this.isBundledTag(node, tagName, options);
		if(!isBundledTag && this.isUsingPropBasedContent(node)) {
			return false;
		}

		// Must come after webc:keep (webc:keep takes precedence)
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.TYPE)) {
			return true;
		}

		if(!component) {
			component = this.getComponent(tagName, options);
		}

		if(component && AstQuery.isVoidElement(tagName)) {
			if(component?.rootAttributeMode !== "merge") { // webc:root="merge"
				return true;
			}
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

	async preparseComponentByFilePath(filePath, ast, content) {
		return this.componentManager.parse(filePath, this.mode, this.dataCascade, ast, content);
	}

	getComponentFilePath(name) {
		return this.componentMapNameToFilePath[name];
	}

	// synchronous (components should already be cached)
	getComponent(name, options) {
		if(!name || !this.componentMapNameToFilePath[name]) {
			// render as a plain-ol-tag
			return false;
		}

		let filePath = this.getComponentFilePath(name);

		// is a circular dependency, render as a plain-ol-tag
		if(this.isCircularDependency(filePath, options)) {
			return false;
		}

		if(!this.componentManager.has(filePath)) {
			throw new Error(`Component at "${filePath}" not found in the component registry.`);
		}
		return this.componentManager.get(filePath);
	}

	// `components` object maps from component name => filename
	async setComponentsByFilePath(components = {}) {
		let promises = [];
		for(let name in components) {
			let filePath = components[name];
			this.componentMapNameToFilePath[name] = Path.normalizePath(filePath);

			promises.push(this.preparseComponentByFilePath(this.componentMapNameToFilePath[name]));
		}

		await Promise.all(promises);
	}

	// This *needs* to be depth first instead of breadth first for **streaming**
	async getChildContent(parentNode, slots, options, streamEnabled) {
		let html = [];
		let previousSiblingFlowControl = {};

		for(let child of parentNode.childNodes || []) {
			let { html: nodeHtml, currentNodeMetadata: meta } = await this.compileNode(child, slots, options, streamEnabled, { previousSiblingFlowControl });
			previousSiblingFlowControl.type = meta.flowControlType;
			// any success should be carried forward
			previousSiblingFlowControl.success = previousSiblingFlowControl.success || meta.flowControlResult;

			html.push(nodeHtml);
		}

		return {
			html: html.join(""),
		};
	}

	getSlottedContentNodes(node, defaultSlot = []) {
		let slots = {};

		// Slot definitions must be top level (this matches browser-based Web Components behavior)
		for(let child of node.childNodes) {
			let slotName = AstQuery.getAttributeValue(child, "slot");
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

	getAttributes(node, component, options) {
		let attrs = node.attrs.slice(0); // Create a new array

		// If this is a top level page-component, make sure we get the top level attributes here
		if(!component && this.filePath === options.closestParentComponent && this.componentManager.has(this.filePath)) {
			component = this.componentManager.get(this.filePath);
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

	// This will be the parent component in component definition files, and the host component in slotted content
	getAuthoredInComponent(options) {
		// slottable content in the host, not in the component definition.
		// https://github.com/11ty/webc/issues/152
		if(options.isSlottableContent && options.authoredInComponent) {
			return this.componentManager.get(options.authoredInComponent);
		}

		return this.componentManager.get(options.closestParentComponent);
	}

	useGlobalDataAtTopLevel(ancestorComponent) {
		return ancestorComponent?.isTopLevelComponent ?? true;
	}

	async renderStartTag(node, tagName, component, renderingMode, options) {
		let content = "";

		if(!tagName) {
			return { content };
		}

		// parse5 doesn’t preserve whitespace around <html>, <head>, and after </body>
		if(renderingMode === "page" && tagName === "head") {
			content += AstSerializer.EOL;
		}

		let attrs = this.getAttributes(node, component, options);
		let parentComponent = this.componentManager.get(options.closestParentComponent);

		// webc:root="override" should use the style hash class name and host attributes since they won’t be added to the host component
		if(parentComponent && parentComponent.ignoreRootTag && AstQuery.getRootNodeMode(node) === "override") {
			if(parentComponent.scopedStyleHash) {
				attrs.push({ name: "class", value: parentComponent.scopedStyleHash });
			}
			for(let hostAttr of options.hostComponentNode?.attrs || []) {
				attrs.push(hostAttr);
			}
		}

		let ancestorComponent = this.getAuthoredInComponent(options);
		let useGlobalData = this.useGlobalDataAtTopLevel(ancestorComponent);
		let nodeData = this.dataCascade.getData( useGlobalData, options.componentProps, options.hostComponentData, ancestorComponent?.setupScript, options.injectedData );
		let evaluatedAttributes = await AttributeSerializer.evaluateAttributesArray(attrs, nodeData, options.closestParentComponent);
		let finalAttributesObject = AttributeSerializer.mergeAttributes(evaluatedAttributes);

		// @attributes
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.ATTRIBUTES)) {
			// note: `@attributes` implies `@attributes="webc.attributes"`
			let extraAttributesContent = AstQuery.getAttributeValue(node, AstSerializer.attrs.ATTRIBUTES) || "webc.attributes";
			let extraAttrs = await this.evaluateAttribute(AstSerializer.attrs.ATTRIBUTES, extraAttributesContent, options);
			Object.assign(finalAttributesObject, AttributeSerializer.getPublicAttributesAsObject(extraAttrs));
		}

		if(options.isMatchingSlotSource) {
			delete finalAttributesObject.slot;
		}

		if(this.showInRawMode(node, options) || !this.isTagIgnored(node, component, renderingMode, options)) {
			content += `<${tagName}${AttributeSerializer.getString(finalAttributesObject)}>`;
		}

		return {
			content,
			attrs: finalAttributesObject,
			nodeData,
		};
	}

	renderEndTag(node, tagName, component, renderingMode, options) {
		let content = "";
		if(tagName) {
			if(AstQuery.isVoidElement(tagName)) {
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

	async transformContent(content, transformTypes, node, slots, options) {
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

		let ancestorComponent = this.getAuthoredInComponent(options);
		let useGlobalData = this.useGlobalDataAtTopLevel(ancestorComponent);
		let context = this.dataCascade.getData(useGlobalData, options.componentProps, options.currentTagAttributes, ancestorComponent?.setupScript, options.injectedData, {
			// Ideally these would be under `webc.*`
			filePath: this.filePath,
			slots: {
				text: slotsText,
			},
			helpers: this.dataCascade.getHelpers(),
		});

		for(let type of transformTypes) {
			content = await this.transforms[type].call({
				type,
				...context
			}, content, ancestorComponent);
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

		return this.componentManager.get(finalFilePath);
	}

	/**
	 * @param {String} slotName
	 * @param {Slots} slots
	 * @param {Node} node
	 * @param {CompileOptions} options
	 * @returns {Promise<string>}
	 * @private
	 */
	 async getContentForNamedSlotNode(slotName, slots, slotNode, options) {
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

			// Render fallback content in a named slot (no slottable content for named slot found)
			if(!slotAst && slotName !== "default") {
				options.isSlottableContent = false;
				options.authoredInComponent = options.closestParentComponent;

				let { html: mismatchedSlotHtml } = await this.getChildContent(slotNode, slots, options, true);
				return mismatchedSlotHtml;
			}

			// Slottable content found, compile it
			options.isSlottableContent = true;

			// inherit one level up
			if(options.authoredInParentComponent) {
				options.authoredInComponent = options.authoredInParentComponent;
				delete options.authoredInParentComponent;
			}

			let { html: slotHtml } = await this.compileNode(slotAst, slots, options, true);
			return slotHtml;
		}

		// No slottable content for `default` found: use fallback content in default slot <slot>fallback content</slot>
		options.isSlottableContent = false;
		options.authoredInComponent = options.closestParentComponent;

		let { html: slotFallbackHtml } = await this.getChildContent(slotNode, null, options, true);
		return slotFallbackHtml;
	}

	/**
	 * @param {Node} node
	 * @param {Slots} slots
	 * @param {CompileOptions} options
	 * @returns {Promise<string>}
	 * @private
	 */
	async getContentForSlotNode(slotNode, slots, options) {
		let slotName = AstQuery.getAttributeValue(slotNode, "name");
		return this.getContentForNamedSlotNode(slotName, slots, slotNode, options);
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
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.RAW) || AstQuery.hasAttribute(node, AstSerializer.attrs.TYPE)) {
			rawContent = this.getPreparsedRawTextContent(node, options);
		} else {
			let templateOptions = Object.assign({}, options);

			// No transformation on this content during first compilation
			delete templateOptions.currentTransformTypes;

			let fakeNode = node.content;
			// parse5 doesn’t have include a parentNode on <template> content, so we’re adding one so that content is output without escaping
			fakeNode._webcFakeParentNode = "template";

			let { html } = await this.compileNode(fakeNode, slots, templateOptions, false);
			rawContent = html;
		}

		if(!options.currentTransformTypes || options.currentTransformTypes.length === 0) {
			return rawContent;
		}

		return this.transformContent(rawContent, options.currentTransformTypes, node, slots, options);
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
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.RAW) || !rawContent.includes("<")) {
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
		let transformTypeStr = AstQuery.getAttributeValue(node, AstSerializer.attrs.TYPE);
		if(transformTypeStr) {
			for(let s of transformTypeStr.split(",")) {
				if(s && !!this.transforms[s]) {
					types.add(s);
				}
			}
		}

		// Always last
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.SCOPED)) {
			types.add(AstSerializer.transformTypes.SCOPED);
		}

		return Array.from(types);
	}

	isCircularDependency(componentFilePath, options) {
		if(options.closestParentComponent) {
			// Slotted content is not counted for circular dependency checks (semantically it is an argument, not a core dependency)
			// <web-component><child/></web-component>
			if(!options.isSlottableContent) {
				if(options.closestParentComponent === componentFilePath || options.components.dependantsOf(options.closestParentComponent).find(entry => entry === componentFilePath) !== undefined) {
					return true;
				}
			}
		}
		return false;
	}

	addComponentDependency(component, tagName, options) {
		let componentFilePath = Path.normalizePath(component.filePath);
		if(!options.components.hasNode(componentFilePath)) {
			options.components.addNode(componentFilePath);
		}

		if(this.isCircularDependency(componentFilePath, options)) {
			throw new Error(`Circular dependency error: You cannot use <${tagName}> inside the definition for ${options.closestParentComponent}`);
		}

		if(options.closestParentComponent) {
			options.components.addDependency(options.closestParentComponent, componentFilePath);
		}

		// reset for next time
		options.closestParentComponent = Path.normalizePath(componentFilePath);
	}

	getAggregateAssetKey(tagName, node, options) {
		if(!this.bundlerMode || options.skipBundle) {
			return false;
		}

		if(tagName === "style" || AstQuery.isLinkStylesheetNode(tagName, node)) {
			return "css";
		}

		if(AstQuery.isScriptNode(tagName, node)) {
			return "js"
		}
	}

	getBucketNamesForBundledNode(currentNodeAttrs, inheritedBuckets) {
		// first look at the current node for a webc:bucket (they are not added to inheritedBuckets)
		if(currentNodeAttrs[AstSerializer.attrs.ASSET_BUCKET]) {
			return [...inheritedBuckets, currentNodeAttrs[AstSerializer.attrs.ASSET_BUCKET]];
		}

		// otherwise use the inherited value
		if(!Array.isArray(inheritedBuckets)) {
			return ["default"];
		}
		return inheritedBuckets;
	}

	isUnescapedTagContent(node) {
		let parentNode = node?.parentNode;
		if(!parentNode) {
			return false;
		}

		// parse5: <template> has no parentNode even when it should (fake it)
		if(parentNode?.nodeName === "#document-fragment" && parentNode?._webcFakeParentNode === "template") {
			return true;
		}

		let tagName = AstQuery.getTagName(parentNode);
		if(tagName === "style" || tagName === "noscript" || tagName === "template" || AstQuery.isScriptNode(tagName, node)) {
			return true;
		}
		return false;
	}

	// Used for @html, @raw, @text, @attributes, webc:if, webc:elseif, webc:for
	async evaluateAttribute(name, attrContent, options) {
		let ancestorComponent = this.getAuthoredInComponent(options);
		let useGlobalData = this.useGlobalDataAtTopLevel(ancestorComponent);
		let data = this.dataCascade.getData(useGlobalData, options.componentProps, ancestorComponent?.setupScript, options.injectedData);
		let { returns } = await ModuleScript.evaluateScriptInline(attrContent, data, `Check the dynamic attribute: \`${name}="${attrContent}"\`.`, options.closestParentComponent);

		return returns;
	}

	// @html or @text or @raw
	async getPropContentAst(node, slots, options) {
		let htmlProp = AstQuery.getAttributeValue(node, AstSerializer.attrs.HTML);
		let textProp = AstQuery.getAttributeValue(node, AstSerializer.attrs.TEXT);
		let rawProp = AstQuery.getAttributeValue(node, AstSerializer.attrs.RAWHTML);

		if([htmlProp, textProp, rawProp].filter(entry => !!entry).length > 1) {
			let tagName = AstQuery.getTagName(node);
			throw new Error(`Node ${tagName} cannot have more than one of: @html${htmlProp ? `="${htmlProp}"` : ""}, @text${textProp ? `="${textProp}"` : ""}, or @raw${rawProp ? `="${rawProp}"` : ""}. Pick one!`);
		}

		let propName;
		let propContent;
		if(htmlProp) {
			propName = AstSerializer.attrs.HTML;
			propContent = htmlProp;
		} else if(textProp) {
			propName = AstSerializer.attrs.TEXT;
			propContent = textProp;
		} else if(rawProp) {
			propName = AstSerializer.attrs.RAWHTML;
			propContent = rawProp;
		}

		if(!propContent) {
			return false;
		}

		let content = await this.evaluateAttribute(propName, propContent, options);

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
			_webCProcessed: true, // should this be htmlProp or textProp only?
		};
	}

	// Requires parse5’s sourceLocationInfo option to be set to true
	getPreparsedRawTextContent(node, options) {
		if(!node.sourceCodeLocation) {
			throw new Error(`We encountered a parsing error. You may have unexpected HTML in your document (${options.authoredInComponent}) or more rarely this may be a WebC error that needs to be filed on our issue tracker: https://github.com/11ty/webc/issues/ (\`getPreparsedRawTextContent\` requires \`parse5->parse->sourceLocationInfo: true\`)`);
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

		let component;
		if(options.useHostComponentMarkup && options.authoredInComponent) {
			component = this.componentManager.get(options.authoredInComponent)
		} else {
			component = this.getAuthoredInComponent(options);
		}

		let {newLineStartIndeces, content} = component;
		let startIndex = newLineStartIndeces[start.endLine - 1] + start.endCol - 1;
		let endIndex = newLineStartIndeces[end.startLine - 1] + end.startCol - 1;

		let rawContent = content.slice(startIndex, endIndex);

		if(os.EOL !== AstSerializer.EOL) {
			// Use replaceAll(os.EOL) when we drop support for Node 14 (see node.green)
			return rawContent.replace(/\r\n/g, AstSerializer.EOL);
		}

		return rawContent;
	}

	addToInheritedBuckets(newBucketName, node, tagName, options) {
		if(!newBucketName) {
			return;
		}

		// we must allow duplicates here
		if(!options.inheritedBuckets || !Array.isArray(options.inheritedBuckets)) {
			options.inheritedBuckets = ["default"];
		}

		let parentBucket = options.inheritedBuckets[options.inheritedBuckets.length - 1];

		if(parentBucket !== newBucketName) {
			if(!this.isBundledTag(node, tagName, options)) {
				options.inheritedBuckets.push(newBucketName);
			}
		}
	}

	async runFlowControl(node, options, metadata) {
		let ret = {
			// properties go to to currentNodeMetadata
			metadata: {}
		};

		let hasIfExpr = AstQuery.hasAttribute(node, AstSerializer.attrs.IF);
		let hasElseIfExpr = AstQuery.hasAttribute(node, AstSerializer.attrs.ELSEIF);
		let hasElseExpr = AstQuery.hasAttribute(node, AstSerializer.attrs.ELSE);

		if(hasIfExpr || hasElseIfExpr || hasElseExpr) {
			let previousSiblingFlowControl = metadata.previousSiblingFlowControl;

			let flowControlEvalContent;
			let flowControlType;
			if(hasIfExpr) {
				flowControlType = AstSerializer.attrs.IF;
				flowControlEvalContent = AstQuery.getAttributeValue(node, AstSerializer.attrs.IF);
			} else if(hasElseIfExpr) {
				if(!previousSiblingFlowControl.type || previousSiblingFlowControl.type !== AstSerializer.attrs.IF && previousSiblingFlowControl.type !== AstSerializer.attrs.ELSEIF) {
					// TODO source code location in error
					throw new Error(`${AstSerializer.attrs.ELSEIF} expected an ${AstSerializer.attrs.IF} or ${AstSerializer.attrs.ELSEIF} on the previous sibling!`);
				}

				flowControlType = AstSerializer.attrs.ELSEIF;
				flowControlEvalContent = AstQuery.getAttributeValue(node, AstSerializer.attrs.ELSEIF);
			} else {
				if(!previousSiblingFlowControl.type || previousSiblingFlowControl.type !== AstSerializer.attrs.IF && previousSiblingFlowControl.type !== AstSerializer.attrs.ELSEIF) {
					// TODO source code location in error
					throw new Error(`${AstSerializer.attrs.ELSE} expected an ${AstSerializer.attrs.IF} or ${AstSerializer.attrs.ELSEIF} on the previous sibling!`);
				}

				flowControlType = AstSerializer.attrs.ELSE;
			}

			ret.metadata.flowControlType = flowControlType;

			if(flowControlType === AstSerializer.attrs.IF || flowControlType === AstSerializer.attrs.ELSEIF && !previousSiblingFlowControl.success) {
				let ifExprValue = false; // if the attribute has no value, assume false
				if(flowControlEvalContent) {
					ifExprValue = await this.evaluateAttribute(flowControlType, flowControlEvalContent, options);
				}

				if(ifExprValue) {
					ret.metadata.flowControlResult = true;
				} else {
					ret.metadata.flowControlResult = false;
					ret.html = "";
				}
			} else if(previousSiblingFlowControl.success) { // at an `else` and previous siblings already success
				ret.html = "";
			}
		}

		return ret;
	}

	async getLoopContent(node, slots = {}, options = {}, streamEnabled = true) {
		let loopAttrValue = AstQuery.getAttributeValue(node, AstSerializer.attrs.LOOP);
		if(!loopAttrValue) {
			return { html: "" };
		}

		let { keys, type, content } = Looping.parse(loopAttrValue);
		let loopContent = await this.evaluateAttribute(AstSerializer.attrs.LOOP, content, options);

		// if falsy, skip
		if(!loopContent) {
			return { html: "" };
		}

		let promises = [];

		if(type === "Object") {
			let index = 0;
			for(let loopKey in loopContent) {
				options.injectedData = {
					[keys.key]: loopKey,
					[keys.value]: loopContent[loopKey],
					[keys.index]: index++,
				};
				promises.push(this.compileNode(node, slots, options, streamEnabled, { loopingActive: true }));
			}
		} else if(type === "Array") {
			promises = loopContent.map(((loopValue, index) => {
				options.injectedData = {
					[keys.index]: index,
					[keys.value]: loopValue
				};

				return this.compileNode(node, slots, options, streamEnabled, { loopingActive: true });
			}));
		}

		// TODO whitespace
		return (await Promise.all(promises)).map(entry => entry.html).filter(entry => entry).join("\n");
	}

	async compileNode(node, slots = {}, options = {}, streamEnabled = true, metadata = {}) {
		options = Object.assign({}, options);

		let currentNodeMetadata = {};

		if(AstQuery.hasAnyAttribute(node, [ AstSerializer.attrs.IGNORE, AstSerializer.attrs.SETUP ])) {
			return { html: "", currentNodeMetadata };
		}
		if(AstQuery.hasAttribute(node, AstSerializer.attrs.LOOP) && !metadata.loopingActive) {
			let html = await this.getLoopContent(node, slots, options, streamEnabled);
			return { html, currentNodeMetadata };
		}

		// Warning: Side effects
		ComponentManager.addImpliedWebCAttributes(node);

		if(AstQuery.hasAttribute(node, AstSerializer.attrs.NOBUNDLE)) {
			options.skipBundle = true;
		}

		let tagName = AstQuery.getTagName(node);
		let content = "";

		let transformTypes = this.getTransformTypes(node);
		if(transformTypes.length) {
			options.currentTransformTypes = transformTypes;
		}

		if(AstQuery.hasAttribute(node, AstSerializer.attrs.RAW)) {
			options.rawMode = true;
		}

		let renderingMode = options.renderingModeOverride || this.getMode(options.closestParentComponent);

		// Short circuit for text nodes, comments, doctypes
		if(node.nodeName === "#text") {
			// Should we use getPreparsedRawTextContent here instead? My hunch is that node.value is okay for now
			let c = node.value;

			// persist flow control info past whitespace only text nodes
			if(metadata.previousSiblingFlowControl?.type && c.trim().length === 0) {
				currentNodeMetadata.flowControlType = metadata.previousSiblingFlowControl?.type;
				currentNodeMetadata.flowControlResult = metadata.previousSiblingFlowControl?.success;
			}

			// Run transforms
			if(options.currentTransformTypes && options.currentTransformTypes.length > 0) {
				c = await this.transformContent(node.value, options.currentTransformTypes, node, slots, options);

				// only reprocess text nodes in a <* webc:is="template" webc:type>
				if(!node._webCProcessed && node.parentNode && AstQuery.getTagName(node.parentNode) === "template") {
					c = await this.compileString(c, node.parentNode, slots, options);
				}
			}

			let unescaped = this.outputHtml(c, streamEnabled);
			if(options.rawMode || this.isUnescapedTagContent(node)) {
				return {
					html: unescaped,
					currentNodeMetadata
				};
			} else {
				// via https://github.com/inikulin/parse5/blob/159ef28fb287665b118c71e1c5c65aba58979e40/packages/parse5-html-rewriting-stream/lib/index.ts
				return {
					html: escapeText(unescaped),
					currentNodeMetadata
				};
			}
		} else if(node.nodeName === "#comment") {
			// passthrough flow control info through comment nodes
			if(metadata.previousSiblingFlowControl?.type) {
				currentNodeMetadata.flowControlType = metadata.previousSiblingFlowControl?.type;
				currentNodeMetadata.flowControlResult = metadata.previousSiblingFlowControl?.success;
			}

			// triple (or more) dashes is a server-only comment
			if(node.data.startsWith("-") && node.data.endsWith("-")) {
				return {
					html: "",
					currentNodeMetadata
				};
			}
			return {
				html: this.outputHtml(`<!--${node.data}-->`, streamEnabled),
				currentNodeMetadata,
			};
		} else if(renderingMode === "page" && node.nodeName === "#documentType") {
			return {
				html: this.outputHtml(`<!doctype ${node.name}>${AstSerializer.EOL}`, streamEnabled),
				currentNodeMetadata,
			};
		}

		let component;

		// This allows use of <img webc:root> inside of an <img> component definition without circular reference errors
		let rootNodeMode = AstQuery.getRootNodeMode(node);
		if(!rootNodeMode) {
			let importSource = AstQuery.getAttributeValue(node, AstSerializer.attrs.IMPORT);
			if(importSource) {
				component = await this.importComponent(importSource, options.closestParentComponent, tagName);
			} else {
				component = this.getComponent(tagName, options);
			}
		}

		if(component) {
			options.closestParentUid = this.getUid();
			// we need to set this so that the props of the host component are evaluated with the webc:root attributes inside the component definition
			AstSerializer.setUid(options.componentProps, options.closestParentUid);
		}

		let flowControl = await this.runFlowControl(node, options, metadata);
		Object.assign(currentNodeMetadata, flowControl.metadata);

		if("html" in flowControl) {
			return {
				html: flowControl.html,
				currentNodeMetadata,
			}
		}

		let slotSource = AstQuery.getAttributeValue(node, "slot");
		if(!options.rawMode && options.closestParentComponent) {
			if(slotSource && options.isSlottableContent) {
				let { slotTargets } = this.componentManager.get(options.closestParentComponent);
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
			AstSerializer.setUid(options.componentProps, options.closestParentUid);
			options.currentTagAttributes = {};

			this.addToInheritedBuckets(options.componentProps[AstSerializer.attrs.ASSET_BUCKET], node, tagName, options);
		} else {
			options.currentTagAttributes = await AttributeSerializer.normalizeAttributesForData(attrs, nodeData);

			this.addToInheritedBuckets(options.currentTagAttributes[AstSerializer.attrs.ASSET_BUCKET], node, tagName, options);
		}


		// @html and @text are aliases for default slot content when used on a host component
		let componentDefinitionHasContent = null;
		let defaultSlotNodesFromProp = [];

		let propContentNode = await this.getPropContentAst(node, slots, options);
		let assetKey = this.getAggregateAssetKey(tagName, node, options);
		if(propContentNode !== false) {
			if(!options.rawMode && component) {
				// Fake AST text node
				defaultSlotNodesFromProp.push(propContentNode);
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
				componentDefinitionHasContent = propContentNode.value.trim().length > 0;
				content += propContentNode.value;
			}
		}

		// Component content (foreshadow dom)
		if(!options.rawMode && component) {
			this.addComponentDependency(component, tagName, options);

			// for attribute sharing (from renderStartTag)
			options.hostComponentNode = node;
			options.hostComponentData = attrs;

			let slots = this.getSlottedContentNodes(node, defaultSlotNodesFromProp);

			// none of the shadow dom in here should inherit slottable info
			options.isSlottableContent = false;
			options.authoredInParentComponent = options.authoredInComponent;

			let { html: foreshadowDom } = await this.compileNode(component.ast, slots, options, streamEnabled);
			componentDefinitionHasContent = foreshadowDom.trim().length > 0;

			content += foreshadowDom;
		}

		// Skip the remaining if we have shadow dom in the component definition
		if(!componentDefinitionHasContent) {
			let externalSource = AstQuery.getExternalSource(tagName, node);

			if(!options.rawMode && tagName === "slot") { // <slot> node
				options.isSlottableContent = true;
				content += await this.getContentForSlotNode(node, slots, options);
			} else if(node.content) {
				let c = await this.getContentForTemplate(node, slots, options);

				if(transformTypes.length > 0 && !node._webCProcessed) { // reprocess <template webc:type>
					c = await this.compileString(c, node, slots, options);
				}

				content += this.outputHtml(c, streamEnabled);
			} else if(node.childNodes?.length > 0 || externalSource) {
				// Fallback to default slottable content if no component shadow dom exists (default slot content)
				if(componentDefinitionHasContent === false) {
					options.isSlottableContent = true;
				}

				if(options.rawMode) {
					let { html: childContent } = await this.getChildContent(node, slots, options, streamEnabled);
					content += childContent;
				} else if(tagName === "template" && options.currentTransformTypes) {
					let { html: childContent } = await this.getChildContent(node, slots, options, false);
					content += this.outputHtml(childContent, streamEnabled);
				} else {
					// Leave node-as is if not CSS/JS or if webc:keep
					if(!assetKey || this.shouldKeepNode(node)) {
						let { html: childContent } = await this.getChildContent(node, slots, options, streamEnabled);
						content += childContent;
					} else { // bundle the thing (e.g. CSS/JS)
						let childContent;
						if(externalSource) { // fetch file contents, note that child content of the node is ignored here
							// We could check to make sure this isn’t already in the asset aggregation bucket *before* we read but that could result in out-of-date content
							let fileContent = this.fileCache.read(externalSource, options.closestParentComponent || this.filePath);
							childContent = await this.transformContent(fileContent, options.currentTransformTypes, node, slots, options);
						} else {
							let { html } = await this.getChildContent(node, slots, options, false);
							childContent = html;
						}

						// `attrs` is generated via renderStartTag
						let buckets = this.getBucketNamesForBundledNode(attrs, options.inheritedBuckets);

						// save to bucket dependency graph
						let lastBucketName;
						for(let bucketName of buckets) {
							if(!options.bucketGraph.hasNode(bucketName)) {
								options.bucketGraph.addNode(bucketName);
							}
							if(lastBucketName) {
								options.bucketGraph.addDependency(bucketName, lastBucketName);
							}
							lastBucketName = bucketName;
						}

						let bucketName = buckets[buckets.length - 1];

						if(!options.assets.buckets[assetKey]) {
							options.assets.buckets[assetKey] = new Set();
						}
						options.assets.buckets[assetKey].add(bucketName);

						let filepath = options.closestParentComponent || this.filePath;
						if(!options.assets[assetKey][filepath]) {
							options.assets[assetKey][filepath] = {};
						}
						if(!options.assets[assetKey][filepath][bucketName]) {
							options.assets[assetKey][filepath][bucketName] = new Set();
						}
						if(!options.assets[assetKey][filepath][bucketName].has(childContent)) {
							options.assets[assetKey][filepath][bucketName].add( childContent );

							// TODO should this entire branch be skipped and assets should always leave as-is when streaming?
							this.streams.output(assetKey, childContent);
						}
					}
				}
			}
		}

		// End tag
		content += this.outputHtml(await this.renderEndTag(node, tagName, component, renderingMode, options), streamEnabled);

		return {
			html: content,
			currentNodeMetadata,
		}
	}

	async compile(node, slots = {}, options = {}) {
		options = Object.assign({
			rawMode: false, // plaintext output
			authoredInComponent: this.filePath,
			skipBundle: false,
			isSlottableContent: false,
			isMatchingSlotSource: false,
			assets: {
				buckets: {
					// "key": new Set()
				},
				css: {},
				js: {},
			},
			components: new DepGraph({ circular: true }),
			bucketGraph: new DepGraph({ circular: true }),
			closestParentComponent: this.filePath,
			closestParentUid: this.getUid(),
		}, options);

		// parse the top level component
		if(!this.componentManager.has(this.filePath)) {
			await this.preparseComponentByFilePath(this.filePath, node, this.content);
		}

		options.components.addNode(this.filePath);
		options.componentProps = {};
		AstSerializer.setUid(options.componentProps, options.closestParentUid);

		try {
			if(node.mode === "quirks") {
				throw new Error(`Quirks mode rendering encountered${this.filePath ? ` for ${this.filePath}` : ""}. A <!doctype html> declaration *is* optional—did you specify a different doctype?`)
			}

			let compiled = await this.compileNode(node, slots, options);
			let content = compiled.html;
			let assets = new AssetManager(options.components, options.bucketGraph);

			let returnObject = {
				html: content,
				components: assets.orderedComponentList.filter(entry => entry !== AstSerializer.FAKE_FS_PATH),
				css: [],
				js: [],
				buckets: {},
			};

			if(this.bundlerMode) {
				Object.assign(returnObject, assets.getBundledAssets(options.assets));
			}

			return returnObject;
		} catch(e) {
			this.streams.error("html", e);
			return Promise.reject(e);
		}
	}
}

export { AstSerializer };
