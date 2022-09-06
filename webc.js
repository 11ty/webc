import fs from "fs";
import { parse } from "parse5";
import { AstSerializer } from "./src/ast.js";

class WebC {
	constructor(options = {}) {
		let { file, input, inputMode } = options;

		this.inputMode = inputMode || "fs";
		this.customTransforms = {};

		if(file) {
			this.filePath = file;
		}
		if(input) {
			this.rawInput = input;
		}

		this.astOptions = {
			filePath: file,
		};
	}

	setInputPath(file) {
		this.filePath = file;
		this.astOptions.filePath = file;
	}

	setInput(input, filePath) {
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
		if(this.rawInput) {
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
		// prepend for no-quirks mode
		if(mode === "component") {
			content = `<!doctype html><html><body>${content}</body></html>`;
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
		if(this.inputMode === "fs") {
			let ast = parse(content, {
				scriptingEnabled: true,
			});
			return ast;
		}
	}

	setTransform(key, callback) {
		this.customTransforms[key] = callback;
	}

	async compile(options = {}) {
		let { content, mode } = this.getContent();
		let rawAst = this.getAST(content);

		let ast = new AstSerializer(this.astOptions);
		ast.setMode(mode);
		ast.setData(options.data);

		for(let name in this.customTransforms) {
			ast.setTransform(name, this.customTransforms[name]);
		}

		await ast.setComponents(options.components);

		return ast.compile(rawAst, options.slots);
	}
}

export { WebC };