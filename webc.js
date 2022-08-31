import fs from "fs";
import { ParserStream } from "parse5-parser-stream";
import { Readable } from "stream";
import { AstSerializer } from "./src/ast.js";

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
		for(let name in this.customTransforms) {
			ast.addTransform(name, this.customTransforms[name]);
		}
		await ast.setComponents(options.components);

		return ast.compile(rawAst, options.slots);
	}
}

export { WebC };