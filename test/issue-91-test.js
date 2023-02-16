import test from "ava";
import { WebC } from "../webc.js";

test("Issue #91 render functions require template", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setInputPath("./test/stubs/issue-91/page.webc");
	component.defineComponents("./test/stubs/issue-91/img.webc");

	let { html, css, js, components } = await component.compile();

	t.is(html, `<img src="my-image.jpeg" alt="An excited Zach is trying to finish this documentation" this-should-be-included extra-attribute class="one two">`);
});
