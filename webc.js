import fs from "fs";
import fastglob from "fast-glob";
import path from "path";
import { parse } from "parse5";
import { TemplatePath } from "@11ty/eleventy-utils";

import { AstSerializer } from "./src/ast.js";

class AstCache {
	constructor() {
		this.ast = {};
	}

	get(contents) {
		if(!this.ast[contents]) {
			this.ast[contents] = parse(contents, {
				scriptingEnabled: true,
			});
		}

		return this.ast[contents];
	}
}

const localAstCache = new AstCache();

class WebC {
	constructor(options = {}) {
		let { file, input } = options;

		this.customTransforms = {};
		this.customHelpers = {};
		this.globalComponents = {};
		this.astOptions = {};
		this.bundlerMode = false;

		if(input) {
			this.rawInput = input;
		}
		if(file) {
			this.setInputPath(file);
		}
	}

	setInputPath(file) {
		file = TemplatePath.addLeadingDotSlash(file);
		this.filePath = file;
		this.astOptions.filePath = file;
	}

	setContent(input, filePath) {
		this.rawInput = input;

		if(filePath) {
			this.astOptions.filePath = filePath;
		}
	}

	getRenderingMode(content) {
		if(!content.startsWith("<!doctype") && !content.startsWith("<html")) {
			return "component";
		}

		return "page";
	}

	_getRawContent() {
		if(this.rawInput || this.rawInput === "") {
			return this.rawInput;
		} else if(this.filePath) {
			if(!this._cachedContent) {
				this._cachedContent = fs.readFileSync(this.filePath, {
					encoding: "utf8"
				});
			}

			return this._cachedContent;
		} else {
			throw new Error("Missing a setInput or setInputPath method call to set the input.");
		}
	}

	getContent() {
		let content = this._getRawContent();
		let mode = this.getRenderingMode(content);

		// prepend for no-quirks mode on components or implicit page rendering modes (starts with <html>)
		if(mode === "component" || !content.startsWith("<!doctype ")) {
			content = `<!doctype html>${content}`;
		}
		
		return {
			content,
			mode,
		};
	}

	static async getASTFromString(string) {
		let wc = new WebC({
			input: string
		});
		let { content } = wc.getContent();
		return wc.getAST(content);
	}

	static async getASTFromFilePath(filePath) {
		let wc = new WebC({
			file: filePath
		});
		let { content } = wc.getContent();
		return wc.getAST(content);
	}

	getAST(content) {
		if(!content) {
			throw new Error("WebC.getAST() expects a content argument.");
		}

		return localAstCache.get(content);
	}

	setTransform(key, callback) {
		this.customTransforms[key] = callback;
	}

	setHelper(key, callback) {
		this.customHelpers[key] = callback;
	}

	async _defineComponentsObject(obj = {}) {
		for(let name in obj) {
			let file = obj[name];
			if(this.globalComponents[name]) {
				throw new Error(`Global component name collision on "${name}" between: ${this.globalComponents[name]} and ${file}`)
			}
			this.globalComponents[name] = file;
		}
	}

	static getComponentsMap(globOrObject) {
		if(typeof globOrObject === "string" || Array.isArray(globOrObject)) {
			let files = globOrObject;

			if(typeof globOrObject === "string") {
				files = fastglob.sync(globOrObject, {
					ignore: ["**/node_modules/**"],
					caseSensitiveMatch: false,
					dot: false,
				});
			}
	
			let obj = {};
			for(let file of files) {
				let {name} = path.parse(file);
				if(obj[name]) {
					throw new Error(`Global component name collision on "${name}" between: ${obj[name]} and ${file}`)
				}
				obj[name] = file;
			}

			return obj;
		}

		return globOrObject;
	}

	defineComponents(globOrObject) {
		this._defineComponentsObject(WebC.getComponentsMap(globOrObject));
	}

	async setup(options = {}) {
		let { content, mode } = this.getContent();
		let rawAst = this.getAST(content);

		let ast = new AstSerializer(this.astOptions);
		ast.setBundlerMode(this.bundlerMode);
		ast.setMode(mode);
		ast.setData(options.data);

		for(let name in this.customTransforms) {
			ast.setTransform(name, this.customTransforms[name]);
		}

		for(let name in this.customHelpers) {
			ast.setHelper(name, this.customHelpers[name]);
		}

		await ast.setComponents(this.globalComponents);
		await ast.setComponents(options.components);

		return {
			ast: rawAst,
			serializer: ast,
		};
	}

	getComponents(setup) {
		let { ast, serializer } = setup;
		let obj = serializer.getComponentList(ast);
		return Object.keys(obj);
	}

	setBundlerMode(mode) {
		this.bundlerMode = !!mode;
	}

	async stream(options = {}) {
		let { ast, serializer } = await this.setup(options);

		serializer.streams.start();

		serializer.compile(ast, options.slots).catch(() => {
			// Node requires this to avoid unhandled rejection errors (yes, even with `finally`)
			serializer.streams.end();
		}).finally(() => {
			serializer.streams.end();
		});

		return serializer.streams.get();
	}

	async compile(options = {}) {
		let { ast, serializer } = await this.setup(options);

		return serializer.compile(ast, options.slots);
	}
}

export { WebC };