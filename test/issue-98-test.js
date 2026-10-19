import test from "node:test";
import { WebC } from "../webc.js";

test("Issue #3 slot inconsistency", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-98/page.webc");
	component.defineComponents("./test/stubs/issue-98/component.webc");

	let { html, css, js, components } = await component.compile();

	t.assert.deepStrictEqual(components, [
		"./test/stubs/issue-98/page.webc",
		"./test/stubs/issue-98/component.webc",
	]);

	t.assert.strictEqual(html, `<div id="hahaha"></div>`);
});