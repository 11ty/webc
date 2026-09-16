import test from "ava";
import { WebC } from "../webc.js";

test("#216 dashes are stripped from webc.renderAttributes", async t => {
	let component = new WebC();
	component.defineComponents("./test/stubs/attrs-dashes/my-component.webc");
	component.setContent(`<my-component data-image-width="100"></my-component>`);

	let { html, css, js, components } = await component.compile();
	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/attrs-dashes/my-component.webc"]);
	t.is(html.trim(), `<div data-image-width="100"></div>`);
});

test("#216 dashes are stripped from @attributes", async t => {
	let component = new WebC();
	component.defineComponents("./test/stubs/attrs-dashes/component-attrs.webc");
	component.setContent(`<component-attrs aria-label="A label"></component-attrs>`);

	let { html, css, js, components } = await component.compile();
	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/attrs-dashes/component-attrs.webc"]);
	t.is(html.trim(), `<div aria-label="A label"></div>`);
});