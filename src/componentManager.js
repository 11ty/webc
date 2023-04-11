import { createHash } from "crypto";

import { WebC } from "../webc.js";
import { AstQuery } from "./astQuery.js";
import { AstModify } from "./astModify.js";
import { AstSerializer } from "./ast.js";
import { ModuleScript } from "./moduleScript.cjs";

class ComponentManager {
	constructor() {
		this.parsingPromises = {};
		this.components = {};
		this.hashOverrides = {};
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

	async getSetupScriptValue(component, filePath, dataCascade) {
		// <style webc:scoped> must be nested at the root
		let setupScriptNode = AstQuery.getFirstTopLevelNode(component, false, AstSerializer.attrs.SETUP);

		if(setupScriptNode) {
			let content = AstQuery.getTextContent(setupScriptNode).toString();

			// importantly for caching: this has no attributes or context sensitive things, only global helpers and global data
			let data = dataCascade.getData(true);

			// async-friendly
			return ModuleScript.evaluateScriptAndReturnAllGlobals(content, filePath, data);
		}
	}

	getRootMode(topLevelNodes) {
		// Has <* webc:root> (has to be a root child, not script/style)
		for(let child of topLevelNodes) {
			let rootNodeMode = AstQuery.getRootNodeMode(child);
			if(rootNodeMode) {
				return rootNodeMode;
			}
		}
	}

	ignoreComponentParentTag(topLevelNodes, rootAttributeMode, hasDeclarativeShadowDom) {
		if(rootAttributeMode) {
			// do not use parent tag if webc:root="override"
			if(rootAttributeMode === "override") {
				return true;
			}

			// use parent tag if webc:root (and not webc:root="override")
			return false;
		}

		// use parent tag if <style> or <script> in component definition (unless <style webc:root> or <script webc:root>)
		// TODO <script webc:type="js"> with implied webc:is="template" https://github.com/11ty/webc/issues/135
		for(let child of topLevelNodes) {
			let tagName = AstQuery.getTagName(child);
			if(tagName !== "script" && tagName !== "style" && !AstQuery.isLinkStylesheetNode(tagName, child) || AstQuery.hasAttribute(child, AstSerializer.attrs.SETUP)) {
				continue;
			}

			if(AstQuery.hasTextContent(child)) {
				return false; // use parent tag if script/style has non-empty values
			}

			// <script src=""> or <link rel="stylesheet" href="">
			if(AstQuery.getExternalSource(tagName, child)) {
				return false; // use parent tag if script/link have external file refs
			}
		}

		// Use parent tag if has declarative shadow dom node (can be anywhere in the component body)
		// We already did the AstQuery.hasDeclarativeShadowDomChild search upstream.
		if(hasDeclarativeShadowDom) {
			return false;
		}

		// Do not use parent tag
		return true;
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
		let styleNodes = AstQuery.getTopLevelNodes(component, [], [AstSerializer.attrs.SCOPED]);

		for(let node of styleNodes) {
			let tagName = AstQuery.getTagName(node);
			if(tagName !== "style" && !AstQuery.isLinkStylesheetNode(tagName, node)) {
				continue;
			}

			// Override hash with scoped="override"
			let override = AstQuery.getAttributeValue(node, AstSerializer.attrs.SCOPED);
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
				// NOTE this does *not* process script e.g. <script webc:type="render" webc:is="style" webc:scoped> (see render-css.webc)
				let hashContent = AstQuery.getTextContent(node).toString();
				hash.update(hashContent);
			} else { // link stylesheet
				// hash based on the file name
				hash.update(AstQuery.getAttributeValue(node, "href"));
			}
		}

		if(styleNodes.length) { // don’t return a hash if empty
			// `base64url` is not available on StackBlitz
			return this.getDigest(hash);
		}
	}

	/* Careful, this one mutates */
	static addImpliedWebCAttributes(node) {
		if(node._webcImpliedAttributesAdded) {
			return;
		}

		node._webcImpliedAttributesAdded = true;

		if(AstQuery.isDeclarativeShadowDomNode(node)) {
			AstModify.addAttribute(node, AstSerializer.attrs.NOBUNDLE, "");
		}

		// webc:type="js" (WebC v0.9.0+) has implied webc:is="template" webc:nokeep
		if(AstQuery.getAttributeValue(node, AstSerializer.attrs.TYPE) === AstSerializer.transformTypes.JS) {
			// this check is perhaps unnecessary since KEEP has a higher precedence than NOKEEP
			if(!AstQuery.hasAttribute(node, AstSerializer.attrs.KEEP)) {
				AstModify.addAttribute(node, AstSerializer.attrs.NOKEEP, "");
			}

			if(!AstQuery.hasAttribute(node, AstSerializer.attrs.IS)) {
				AstModify.addAttribute(node, AstSerializer.attrs.IS, "template");
			}
		}
	}

	has(filePath) {
		return filePath in this.components;
	}

	get(filePath) {
		return this.components[filePath];
	}

	async parse(filePath, mode, dataCascade, ast, content) {
		if(this.components[filePath]) {
			// already parsed
			return;
		}

		// parsing in progress
		if(this.parsingPromises[filePath]) {
			return this.parsingPromises[filePath];
		}

		let parsingResolve;
		this.parsingPromises[filePath] = new Promise((resolve) => {
			parsingResolve = resolve;
		});

		let isTopLevelComponent = !!ast; // ast is passed in for Top Level components

		// if ast is provided, this is the top level component
		if(!isTopLevelComponent) {
			mode = "component";
		}

		if(!ast) {
			let parsed = await WebC.getFromFilePath(filePath);
			ast = parsed.ast;
			content = parsed.content;
			mode = parsed.mode;
		}

		let scopedStyleHash = this.getScopedStyleHash(ast, filePath);
		// only executes once per component
		let setupScript = await this.getSetupScriptValue(ast, filePath, dataCascade);
		let hasDeclarativeShadowDom = AstQuery.hasDeclarativeShadowDomChild(ast);

		let topLevelNodes = AstQuery.getTopLevelNodes(ast);

		// important for ignoreComponentParentTag, issue #135
		for(let node of topLevelNodes) {
			ComponentManager.addImpliedWebCAttributes(node);
		}

		let rootAttributeMode = this.getRootMode(topLevelNodes);
		let ignoreRootTag = this.ignoreComponentParentTag(topLevelNodes, rootAttributeMode, hasDeclarativeShadowDom);
		let slotTargets = AstQuery.getSlotTargets(ast);

		this.components[filePath] = {
			filePath,
			ast,
			content,
			get newLineStartIndeces() {
				if(!this._lineStarts) {
					this._lineStarts = ComponentManager.getNewLineStartIndeces(content);
				}
				return this._lineStarts;
			},

			mode,
			isTopLevelComponent,
			hasDeclarativeShadowDom,
			ignoreRootTag,
			scopedStyleHash,
			rootAttributeMode,
			rootAttributes: AstQuery.getRootAttributes(ast, scopedStyleHash),
			slotTargets: slotTargets,
			setupScript,
		};

		parsingResolve();
	}
}

export { ComponentManager };