import test from "ava";
import path from "node:path";

import { WebC, customLoader } from "../webc.js";

const files = {
	"./virtual/page.webc": `<p>Virtual page</p>
<link rel="stylesheet" href="style.css">
<script src="script.js"></script>`,
	"virtual/style.css": `/* virtual css */`,
	"virtual/script.js": `/* virtual js */`,
};

test.serial("customLoader replaces file reads", async t => {
	let { load, resolve } = customLoader;
	let resolved = [];

	customLoader.load = async (filePath) => {
		if(!(filePath in files)) {
			throw new Error(`Missing virtual file: ${filePath}`);
		}
		return files[filePath];
	};
	customLoader.resolve = (...args) => {
		resolved.push(args);
		return path.resolve(...args);
	};

	t.teardown(() => {
		customLoader.load = load;
		customLoader.resolve = resolve;
	});

	let component = new WebC();
	component.setInputPath("./virtual/page.webc");
	component.setBundlerMode(true);

	let { html, css, js } = await component.compile();

	t.is(html.trim(), `<p>Virtual page</p>`);
	t.deepEqual(css, [`/* virtual css */`]);
	t.deepEqual(js, [`/* virtual js */`]);
	t.true(resolved.length > 0);
});
