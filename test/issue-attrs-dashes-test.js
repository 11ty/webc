import test from "node:test";
import { WebC } from "../webc.js";

test("#216 dashes are stripped from webc.renderAttributes", async t => {
	let component = new WebC();
	component.defineComponents("./test/stubs/attrs-dashes/my-component.webc");
	component.setContent(`<my-component data-image-width="100"></my-component>`);

	let { html, css, js, components } = await component.compile();
	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, ["./test/stubs/attrs-dashes/my-component.webc"]);
	t.assert.strictEqual(html.trim(), `<div data-image-width="100"></div>`);
});

test("#216 dashes are stripped from @attributes", async t => {
	let component = new WebC();
	component.defineComponents("./test/stubs/attrs-dashes/component-attrs.webc");
	component.setContent(`<component-attrs aria-label="A label"></component-attrs>`);

	let { html, css, js, components } = await component.compile();
	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, ["./test/stubs/attrs-dashes/component-attrs.webc"]);
	t.assert.strictEqual(html.trim(), `<div aria-label="A label"></div>`);
});