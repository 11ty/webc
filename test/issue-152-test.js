import test from "ava";
import { WebC } from "../webc.js";

test("Slotted global data access #152", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setInputPath("./test/stubs/issue-152/page.webc");
	component.defineComponents("./test/stubs/issue-152/site-card.webc");

	let { html } = await component.compile({
		data: {
			globalData: "Hello"
		}
	});

	t.is(html.trim(), `<site-card>Hello I am in the default slot.<span>Hello</span></site-card>`);
});
