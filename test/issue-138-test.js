import test from "ava";
import { WebC } from "../webc.js";

test("Circular dep error #138", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-138/page.webc");
	component.defineComponents("./test/stubs/issue-138/img.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<img src="my-image.jpeg" alt="An excited Zach is trying to finish this documentation" lol">`);
});
