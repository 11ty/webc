import test from "node:test";
import path from "node:path";

import { WebC, customLoader } from "../webc.js";

const files = {
	"./virtual/page.webc": `<p>Virtual page</p>
<link rel="stylesheet" href="style.css">
<script src="script.js"></script>`,
	"virtual/style.css": `/* virtual css */`,
	"virtual/script.js": `/* virtual js */`,
};

test("customLoader replaces file reads", async t => {
	let { load, resolve } = customLoader;
	let resolved = [];

	customLoader.load = async (filePath) => {
		// Normalize Windows separators from path.join
		filePath = filePath.split(path.sep).join("/");
		if(!(filePath in files)) {
			throw new Error(`Missing virtual file: ${filePath}`);
		}
		return files[filePath];
	};
	customLoader.resolve = (...args) => {
		resolved.push(args);
		return path.resolve(...args);
	};

	t.after(() => {
		customLoader.load = load;
		customLoader.resolve = resolve;
	});

	let component = new WebC();
	component.setInputPath("./virtual/page.webc");
	component.setBundlerMode(true);

	let { html, css, js } = await component.compile();

	t.assert.strictEqual(html.trim(), `<p>Virtual page</p>`);
	t.assert.deepStrictEqual(css, [`/* virtual css */`]);
	t.assert.deepStrictEqual(js, [`/* virtual js */`]);
	t.assert.ok(resolved.length > 0);
});
