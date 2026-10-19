import test from "node:test";
import { WebC } from "../webc.js";

test("Slottable webc:type transform #118", async t => {
	t.plan(2);
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-118/page.webc");
	component.defineComponents("./test/stubs/issue-118/oh-no.webc");
	component.setTransform("override", (content) => {
		t.assert.ok( content );
		return `This is an override`;
	});

	let { html } = await component.compile();

	t.assert.strictEqual(html.trim(), `<div>This is an override</div>`);
});