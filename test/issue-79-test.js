import test from "ava";
import { WebC } from "../webc.js";

test("webc:import in Components should be relative to component file #79", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-79/pages/articles/my-page.webc");
	component.defineComponents("./test/stubs/issue-79/components/**.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<any-tag-name><script>stub()</script></any-tag-name>`);
});

