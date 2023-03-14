import { createHash } from "crypto";

import { WebC } from "../webc.js";
import { AstQuery } from "./astQuery.js";
import { AstSerializer } from "./ast.js";
import { ModuleScript } from "./moduleScript.cjs";

class ComponentManager {
	constructor() {
		this.parsingPromises = {};
		this.components = {};
		this.hashOverrides = {};
	}

	async getSetupScriptValue(component, filePath, dataCascade) {
		// <style webc:scoped> must be nested at the root
		let setupScriptNode = AstQuery.getFirstTopLevelNode(component, false, AstSerializer.attrs.SETUP);

		if(setupScriptNode) {
			let content = AstQuery.getTextContent(setupScriptNode).toString();

			// importantly for caching: this has no attributes or context sensitive things, only global helpers and global data
			let data = dataCascade.getData();

			// async-friendly
			return ModuleScript.evaluateScriptAndReturnAllGlobals(content, filePath, data);
		}
	}

	ignoreComponentParentTag(component, hasDeclarativeShadowDom) {
		// Has <* webc:root> (has to be a root child, not script/style)
		let tops = AstQuery.getTopLevelNodes(component);
		for(let child of tops) {
			let rootNodeMode = AstQuery.getRootNodeMode(child);
			if(rootNodeMode) {
				// do not use parent tag if webc:root="override"
				if(rootNodeMode === "override") {
					return true;
				}

				// use parent tag if webc:root (and not webc:root="override")
				return false;
			}
		}

		// use parent tag if <style> or <script> in component definition (unless <style webc:root> or <script webc:root>)
		for(let child of tops) {
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
			hasDeclarativeShadowDom,
			ignoreRootTag: this.ignoreComponentParentTag(ast, hasDeclarativeShadowDom),
			scopedStyleHash,
			rootAttributes: AstQuery.getRootAttributes(ast, scopedStyleHash),
			slotTargets: AstQuery.getSlotTargets(ast),
			setupScript,
		};

		parsingResolve();
	}
}

export { ComponentManager };