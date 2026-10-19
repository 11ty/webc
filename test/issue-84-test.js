import test from "node:test";
import { WebC } from "../webc.js";

// This doesn’t technically test console.log output but it’s close enough for now 😅
test("Non string output from webc:type=js #84", async t => {
	let component = new WebC();
	component.setContent(`<script webc:type="js" webc:is="template">
export default 1;
</script>`);

	let { html } = await component.compile();

	t.assert.strictEqual(html, `1`);
});
