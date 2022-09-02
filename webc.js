import fs from "fs";
import { parse } from "parse5";
import { AstSerializer } from "./src/ast.js";

class WebC {
	constructor(options = {}) {
		let { file, input, mode, inputMode } = options;

		this.inputMode = inputMode || "fs";
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

	getInputStream() {
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

	getInputContent() {
		if(this.filePath) {
			return fs.readFileSync(this.filePath, {
				encoding: "utf8"
			});
		} else if(this.rawInput) {
			return this.rawInput;
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

	async getAST() {
		if(this.inputMode === "fs") {
			let content = this.getInputContent();
			if(this.astOptions.mode === "component") {
				content = `<!doctype html><body>${content}</body></html>`;
			}
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
		let rawAst = await this.getAST();

		let ast = new AstSerializer(this.astOptions);
		for(let name in this.customTransforms) {
			ast.setTransform(name, this.customTransforms[name]);
		}

		await ast.setComponents(options.components);

		return ast.compile(rawAst, options.slots);
	}
}

export { WebC };