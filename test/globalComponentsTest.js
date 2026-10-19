import test from "node:test";
import path from "node:path";

import { WebC } from "../webc.js";

test("Uses a global component (register by glob)", async t => {
	let component = new WebC();
	component.setContent(`<my-custom-element></my-custom-element>`);
	component.defineComponents("./test/stubs/global-components/*");

	let { html, css, js, components } = await component.compile();

	t.assert.strictEqual(html, `This is a global component.`);

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, ["./test/stubs/global-components/my-custom-element.webc"]);
});

test("Uses a global component (registered explicitly with object)", async t => {
	let component = new WebC();
	component.setContent(`<my-custom-element></my-custom-element>`);

	component.defineComponents({
		"my-custom-element": "./test/stubs/global-components/my-custom-element.webc"
	});

	let { html, css, js, components } = await component.compile();

	t.assert.strictEqual(html, `This is a global component.`);

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, ["./test/stubs/global-components/my-custom-element.webc"]);
});

test("Uses a global component (registered explicitly with Array)", async t => {
	let component = new WebC();
	component.setContent(`<my-custom-element></my-custom-element>`);

	component.defineComponents(["./test/stubs/global-components/my-custom-element.webc"]);

	let { html, css, js, components } = await component.compile();

	t.assert.strictEqual(html, `This is a global component.`);

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, ["./test/stubs/global-components/my-custom-element.webc"]);
});



test("Uses a global component with CSS and JS", async t => {
	let component = new WebC();
	component.setContent(`<other-custom-element></other-custom-element>`);
	component.defineComponents("./test/stubs/global-components/*");
	component.setBundlerMode(true);

	let { html, css, js, components } = await component.compile();

	t.assert.strictEqual(html, `<other-custom-element><p>This is another global component.</p>

</other-custom-element>`);

	t.assert.deepStrictEqual(js, [`
alert("hi");
`]);
	t.assert.deepStrictEqual(css, [`
p { color: blue; }
`]);
	t.assert.deepStrictEqual(components, ["./test/stubs/global-components/other-custom-element.webc"]);
});

test("Naming collision errors", async t => {
	let component = new WebC();
	t.assert.throws(() => component.defineComponents("./test/stubs/global-components/**"));
});

test("findGlob keeps the pattern prefix in results", t => {
	let abs = path.resolve("test/stubs/global-components").split(path.sep).join("/");
	t.assert.deepStrictEqual(WebC.findGlob(`${abs}/my-*.webc`), [`${abs}/my-custom-element.webc`]);
	t.assert.deepStrictEqual(WebC.findGlob("./test/stubs/global-components/my-*.webc"), ["./test/stubs/global-components/my-custom-element.webc"]);
	t.assert.deepStrictEqual(WebC.findGlob("test/stubs/global-components/my-*.webc"), ["test/stubs/global-components/my-custom-element.webc"]);
});
