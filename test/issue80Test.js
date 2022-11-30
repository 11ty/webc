import test from "ava";
import { WebC } from "../webc.js";

test("Dynamic attributes in components (attribute -> dynamic -> dynamic) #80", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-80/page.webc");
	component.defineComponents("./test/stubs/issue-80/b.webc");
	component.defineComponents("./test/stubs/issue-80/c.webc");

	let { html } = await component.compile();

	t.is(html, `<div foo="xyz">
  <img src="xyz">
</div>`);
});

test("Dynamic attributes in components (dynamic -> dynamic -> dynamic) #80", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-80-b/page.webc");
	component.defineComponents("./test/stubs/issue-80-b/b.webc");
	component.defineComponents("./test/stubs/issue-80-b/c.webc");

	let { html } = await component.compile();

	t.is(html, `<div foo="xyz">
  <img src="xyz">
</div>`);
});
