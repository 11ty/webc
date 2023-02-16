import test from "ava";
import { WebC } from "../webc.js";

test("non-string props #94", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-94/component.webc");

	component.setContent(`<component :numeric="1"></component>|<component :@numeric="1"></component>`);

	let { html } = await component.compile();

	t.is(html.trim(), `number|number`);
});