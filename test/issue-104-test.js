import test from "ava";
import { WebC } from "../webc.js";

test("Easy way to render all public attributes in script #104", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/component.webc");

	component.setContent(`<component :attr1="1" attr2="2" @attr3="3" :@attr4="4"></component>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<img attr1="1" attr2="2">`);
});

test("@attributes with object #114", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/attrs-object.webc");

	component.setContent(`<attrs-object :attr1="1" attr2="2" @attr3="3" :@attr4="4"></attrs-object>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<img myKey="1">`);
});

test("Easy way to render all public attributes with webc:root #104", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/root-component.webc");

	component.setContent(`<root-component :attr1="1" attr2="2" @attr3="3" :@attr4="4"></root-component>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<img attr1="1" attr2="2" class="two">`);
});

test("Easy way to render all public attributes with @attributes without webc:root #104", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/attrs-component.webc");

	component.setContent(`<attrs-component :attr1="1" attr2="2" @attr3="3" :@attr4="4"></attrs-component>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div><img attr1="1" attr2="2"></div>`);
});

test("Easy way to render all public attributes with @attributes with webc:root #104", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/root-attrs-component.webc");

	component.setContent(`<root-attrs-component :attr1="1" attr2="2" @attr3="3" :@attr4="4"></root-attrs-component>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<root-attrs-component attr1="1" attr2="2"></root-attrs-component>`);
});

test("Easy way to render all public attributes with @attributes with webc:root=override #104", async t => {
	let component = new WebC();

	component.defineComponents("./test/stubs/issue-104/root-override-attrs-component.webc");

	component.setContent(`<root-override-attrs-component :attr1="1" attr2="2" @attr3="3" :@attr4="4"></root-override-attrs-component>`);

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