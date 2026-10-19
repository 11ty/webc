import test from "node:test";
import { WebC } from "../webc.js";


test("Using @html", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/html.webc");

	let { html, css, js, components } = await component.compile({
		data: {
			variable1: "value1"
		}
	});

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, [
		"./test/stubs/html.webc",
	]);

	t.assert.strictEqual(html, `<p>Paragraph HTML</p>
<p>value1</p>
<template>Template HTML</template>
<template>Template HTML Keep</template>
Template HTML Nokeep
`);
});

test("Using @text", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body @text="myText"></body>
</html>`);

	let { html, css, js, components } = await component.compile({
		data: {
			myText: "<p>This is text</p>"
		}
	});

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, []);

	t.assert.strictEqual(html, `<!doctype html>
<html>
<head></head><body>&lt;p&gt;This is text&lt;/p&gt;</body>
</html>`);
});

test("Using a helper in dynamic attribute and @html", async(t) => {
	let component = new WebC();
	component.setHelper("helper", function(a) {
		return a+"Blue"; 
	});
	component.setContent(`<template :key="helper('other')" @html="helper('test')"></template>`);

	let { html } = await component.compile();

	t.assert.strictEqual(html, `<template key="otherBlue">testBlue</template>`);
});

test("Using a helper (without this) in dynamic attribute and @html", async(t) => {
	let component = new WebC();
	component.setHelper("helper", (a) => { return a+"Blue"; });
	component.setContent(`<template :key="helper('other')" @html="helper('test')"></template>`);

	let { html } = await component.compile();

	t.assert.strictEqual(html, `<template key="otherBlue">testBlue</template>`);
});


test("Use @html with undefined properties or helpers", async (t) => {
	let component = new WebC();
	component.setInputPath("./test/stubs/props-missing.webc");

	let { html, css, js, components } = await component.compile();

	t.assert.strictEqual(html, `<span></span>
`);
});

test("Use @html with undefined properties or helpers (without this)", async (t) => {
	let component = new WebC();
	component.setInputPath("./test/stubs/props-missing-nothis.webc");

	let { html, css, js, components } = await component.compile();

	t.assert.strictEqual(html, `<span></span>

`);
});


test("Setting @html and/or :attr to a number (non-string)", async t => {
	let component = new WebC();
	component.setInputPath("./test/stubs/html-number.webc");

	let { html, css, js, components } = await component.compile();

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, [
		"./test/stubs/html-number.webc",
	]);

	t.assert.strictEqual(html, `<span attr="2">2</span>`);
});


test("Using a component with @html should still aggregate assets (issue #29)", async (t) => {
	let component = new WebC();
	component.setBundlerMode(true);

	component.setInputPath("./test/stubs/component-html-assets.webc");
	component.defineComponents({
		"my-component": "./test/stubs/components/assets.webc",
	});

	let { html, css, js } = await component.compile();
	t.assert.strictEqual(html, `<my-component>HTML
<p>Test</p>

</my-component>`);
t.assert.deepStrictEqual(css, [`/* CSS */`]);
t.assert.deepStrictEqual(js, [`/* JS */`]);
});

test("Returning component markup from @html should resolve components (via issue #29)", async (t) => {
	let component = new WebC();
	component.setBundlerMode(true);

	component.setInputPath("./test/stubs/component-html-resolve.webc");
	component.defineComponents({
		"child": "./test/stubs/components/nested-child.webc",
	});

	let { html, css, js } = await component.compile({
		data: {
			sampleChildMarkup: "<child></child>"
		}
	});
	t.assert.strictEqual(html, `<p>SSR content</p>`);
t.assert.deepStrictEqual(css, []);
t.assert.deepStrictEqual(js, []);
});

test("script @html should bundle (issue #16, maybe via issue #29)", async (t) => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setInputPath("./test/stubs/component-script-html.webc");
	component.defineComponents({
		"my-component": "./test/stubs/components/script-html.webc",
	});

	let { html, css, js } = await component.compile({
		data: {
			sampleScript: "alert('hi');"
		}
	});
	t.assert.strictEqual(html, ``);
t.assert.deepStrictEqual(css, []);
t.assert.deepStrictEqual(js, [`alert('hi');`]);
});

test("raw template with nokeep and @html", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/webc-raw-html-prop.webc");
	component.defineComponents("./test/stubs/components/nested-child.webc");

	let { html, css, js, components } = await component.compile({
		data: {
			content: "<nested-child></nested-child>"
		}
	});

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, [
		"./test/stubs/webc-raw-html-prop.webc",
	]);

	t.assert.strictEqual(html, `<!doctype html>
<html>
<head></head><body><nested-child></nested-child></body>
</html>`);
});

test("No reprocessing when using @raw, #70 (related to issue #33)", async (t) => {
	let component = new WebC();

	component.setInputPath("./test/stubs/webc-raw-prop.webc");
	component.defineComponents("./test/stubs/components/nested-child.webc");

	let { html, css, js, components } = await component.compile({
		data: {
			content: `<nested-child @prop="test"></nested-child>`
		}
	});

	t.assert.strictEqual(html, `<!doctype html>
<html>
<head></head><body><nested-child @prop="test"></nested-child></body>
</html>`);

	t.assert.deepStrictEqual(js, []);
	t.assert.deepStrictEqual(css, []);
	t.assert.deepStrictEqual(components, [
		"./test/stubs/webc-raw-prop.webc",
	]);
});

test("@html and @text", async (t) => {
	let component = new WebC();
	component.setContent(`<template @html="'Test'" @text="'Test'"></template>`);

	await t.assert.rejects(component.compile(), {
		message: `Node template cannot have more than one of: @html="'Test'", @text="'Test'", or @raw. Pick one!`
	});
});

test("@raw and @text", async (t) => {
	let component = new WebC();
	component.setContent(`<template @raw="'Test'" @text="'Test'"></template>`);

	await t.assert.rejects(component.compile(), {
		message: `Node template cannot have more than one of: @html, @text="'Test'", or @raw="'Test'". Pick one!`
	});
});

test("@html and @raw", async (t) => {
	let component = new WebC();
	component.setContent(`<template @html="'Test'" @raw="'Test'"></template>`);

	await t.assert.rejects(component.compile(), {
		message: `Node template cannot have more than one of: @html="'Test'", @text, or @raw="'Test'". Pick one!`
	});
});

test("@html and @text and @raw", async (t) => {
	let component = new WebC();
	component.setContent(`<template @html="'Test'" @text="'Test'" @raw="'Test'"></template>`);

	await t.assert.rejects(component.compile(), {
		message: `Node template cannot have more than one of: @html="'Test'", @text="'Test'", or @raw="'Test'". Pick one!`
	});
});

