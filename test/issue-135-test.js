import test from "node:test";
import { WebC } from "../webc.js";

test("script render function implied template should still be HTML-only #135", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-135/page.webc");
	component.defineComponents("./test/stubs/issue-135/component.webc");

	let { html } = await component.compile();

	t.assert.strictEqual(html.trim(), `<p>hello</p>`);
});
