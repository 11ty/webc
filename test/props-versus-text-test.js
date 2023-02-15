import test from "ava";
import { WebC } from "../webc.js";

test("Props versus @text", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/props-versus-text/page.webc");

	let { html } = await component.compile({
		data: {
			pdf: "hello"
		}
	});

	t.is(html.trim(), `<noscript><a href="hello"><span>hello</span></a></noscript>`);
});
