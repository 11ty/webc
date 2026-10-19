import test from "node:test";
import { WebC } from "../webc.js";

test("Props versus @text", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/props-versus-text/page.webc");

	let { html } = await component.compile({
		data: {
			pdf: "hello"
		}
	});

	t.assert.strictEqual(html.trim(), `<noscript><a href="hello"><span>hello</span></a></noscript>`);
});
