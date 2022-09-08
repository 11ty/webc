import test from "ava";

import { WebC } from "../webc.js";

test("Uses a global component", async t => {
	let component = new WebC();
	component.setInput(`<my-custom-element></my-custom-element>`);
	await component.addGlobalComponents("./test/stubs/global-components/*");

	let { html, css, js, components } = await component.compile();

	t.is(html, `This is a global component.`);

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/global-components/my-custom-element.webc"]);
});

test("Uses a global component with CSS and JS", async t => {
	let component = new WebC();
	component.setInput(`<other-custom-element></other-custom-element>`);
	await component.addGlobalComponents("./test/stubs/global-components/*");

	let { html, css, js, components } = await component.compile();

	t.is(html, `<other-custom-element><p>This is another global component.</p>

</other-custom-element>`);

	t.deepEqual(js, [`
alert("hi");
`]);
	t.deepEqual(css, [`
p { color: blue; }
`]);
	t.deepEqual(components, ["./test/stubs/global-components/other-custom-element.webc"]);
});

test("Naming collision errors", async t => {
	let component = new WebC();
	await t.throwsAsync(component.addGlobalComponents("./test/stubs/global-components/**"));
});
