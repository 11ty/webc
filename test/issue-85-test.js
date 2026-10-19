import test from "node:test";
import { WebC } from "../webc.js";

test("Missing props #85", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-85/page.webc");

	let { html } = await component.compile();

	t.assert.strictEqual(html.trim(), `<a href="undefined">Your image didn’t have an alt so you get this link instead.</a>`);
});
