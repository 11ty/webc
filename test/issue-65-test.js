import test from "node:test";
import { WebC } from "../webc.js";

async function compile(content, data) {
	let component = new WebC();
	component.setBundlerMode(true);
	component.defineComponents("./test/stubs/issue-65/*.webc");
	component.setInputPath("./test/stubs/issue-65/page.webc");
	component.setContent(content);

	return component.compile({ data });
}

test("Dynamic :href in webc:for is bundled #65", async t => {
	let { html, css } = await compile(`<link webc:for="href of stylesheets" rel="stylesheet" :href="href">`, { stylesheets: ["a.css", "b.css"] });
	t.assert.strictEqual(html.trim(), "");
	t.assert.deepStrictEqual(css, ["/* This is some CSS */", "/* b */"]);
});

test("Component with only a dynamic :href stylesheet keeps its host tag, matching static href #65", async t => {
	let { html, css } = await compile(`<c-dynamic-style></c-dynamic-style>`);
	t.assert.strictEqual(html.trim(), "<c-dynamic-style></c-dynamic-style>");
	t.assert.deepStrictEqual(css, ["/* This is some CSS */"]);
});
