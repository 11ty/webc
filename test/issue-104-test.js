import test from "ava";
import { WebC } from "../webc.js";

test("Easy way to render all public attributes in script #104", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/component.webc");

	component.setContent(`<component :attr1="1" attr2="2" @attr3="3" :@attr4="4"></component>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<img attr1="1" attr2="2">`);
});

// TODO Requires per-instance webc:setup to have access to attributes
test.skip("Easy way to render all public attributes in script with webc:setup #104", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/setup-component.webc");

	component.setContent(`<setup-component :attr1="1" attr2="2" @attr3="3" :@attr4="4"></setup-component>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<img attr1="1" attr2="2">`);
});