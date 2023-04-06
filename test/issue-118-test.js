import test from "ava";
import { WebC } from "../webc.js";

test("Slottable webc:type transform #118", async t => {
	t.plan(2);
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-118/page.webc");
	component.defineComponents("./test/stubs/issue-118/oh-no.webc");
	component.setTransform("override", (content) => {
		t.truthy( content );
		return `This is an override`;
	});

	let { html } = await component.compile();

	t.is(html.trim(), `<div>This is an override</div>`);
});