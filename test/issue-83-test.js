import test from "node:test";
import { WebC } from "../webc.js";

// This doesn’t technically test console.log output but it’s close enough for now 😅
test("console log in webc:type=js #83", async t => {
	t.plan(2);

	let component = new WebC();
	component.setContent(`<script webc:type="js" webc:is="template">
export default function({ console }) {
	let message = 1 + 1;
	console.log(message);
	return "hello " + message;
}
</script>`);

	let { html } = await component.compile({
		data: {
			console: {
				log: function(message) {
					t.assert.strictEqual(message, 2);
				}
			}
		}
	});

	t.assert.strictEqual(html, `hello 2`);
});
