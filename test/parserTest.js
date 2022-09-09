import test from "ava";
import MarkdownIt from "markdown-it";
import typescript from "typescript";

import { WebC } from "../webc.js";

test("Raw Input", async t => {
	let component = new WebC();
	component.setContent(`<div class="red"></div>`);

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html, `<div class="red"></div>`);
});

test("No Quirks mode default (HTML file without doctype)", async t => {
	let component = new WebC();
	component.setContent(`<html><div class="red"></div></html>`);

	let {content} = component.getContent();
	let ast = await component.getAST(content);

	t.is("no-quirks", ast.mode);
});

test("No Quirks mode default", async t => {
	let component = new WebC();
	component.setContent(`<div class="red"></div>`);

	let {content} = component.getContent();
	let ast = await component.getAST(content);

	t.is("no-quirks", ast.mode);
});

test("Throw an error if quirks mode", async t => {
	let component = new WebC();
	component.setContent(`<!doctype alksdjfasdf><p></p>`);

	// await component.compile();
	await t.throwsAsync(component.compile());
});

const fileInputStubs = {
	"./test/stubs/empty.webc": {
		description: "Empty file",
		content: "",
	},

	// HTML
	"./test/stubs/no-template.webc": {
		description: "No top level <template> required",
		content: `<div class="test"></div>`,
	},

	"./test/stubs/img.webc": {
		description: "Image element",
		content: `<img src="test.jpg">`,
	},

	"./test/stubs/comment.webc": {
		description: "HTML Comment",
		content: `<!-- comment -->`,
	},

	"./test/stubs/nested-link.webc": {
		description: "Un-nests nested links (same as web)",
		content: `<a href="#">Parent</a><a href="#">Child</a>`,
	},

	// Style
	"./test/stubs/style.webc": {
		description: "One empty <style>",
		content: "",
	},
};

for(let filename in fileInputStubs) {
	let stub = fileInputStubs[filename]
	test(stub.description || filename, async t => {
		let component = new WebC();
		
		component.setInputPath(filename);
		
		let { html, css, js, components } = await component.compile();

		t.deepEqual(js, []);
		t.deepEqual(css, []);
		t.deepEqual(components, [filename]);

		t.is(html.trim(), stub.content);
	});
}

test("Using a top level <template>", async t => {
	let component = new WebC();
	
	component.setInputPath("./test/stubs/template.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/template.webc"]);
	t.is(html.trim(), `<template>
	<div class="test"></div>
</template>`);
});

test("Using a custom <template webc:type> (empty) gets rid of parent <template>", async t => {
	let component = new WebC();
	component.setInputPath("./test/stubs/template-custom-notype.webc");

	let { html, css, js, components } = await component.compile();
	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/template-custom-notype.webc"]);
	t.is(html, `
No <code>content</code>.
`);
});

test("Using a custom <template> type", async t => {
	let component = new WebC();
	let md = new MarkdownIt({ html: true });

	component.setInputPath("./test/stubs/template-custom.webc");
	component.setTransform("md", (content) => {
		return md.render(content);
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/template-custom.webc"]);
	t.is(html.trim(), `<h1>Header</h1>`);
});

test("Using a custom <template> type (<template><div>)", async t => {
	let component = new WebC();
	let md = new MarkdownIt({ html: true });

	component.setInputPath("./test/stubs/template-custom-nested.webc");
	component.setTransform("md", (content) => {
		return md.render(content);
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/template-custom-nested.webc"]);
	t.is(html.trim(), `<div># Header</div>
<h1>Header <code>Test</code></h1>`);
});

test("Using a custom <template> type with webc:keep", async t => {
	let component = new WebC();
	let md = new MarkdownIt({ html: true });

	component.setInputPath("./test/stubs/template-custom-keep.webc");
	component.setTransform("md", (content) => {
		return md.render(content);
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/template-custom-keep.webc"]);
	t.is(html.trim(), `<template><h1>Header</h1>
</template>`);
});

test("Using a async custom <template> type with webc:keep", async t => {
	let component = new WebC();
	let md = new MarkdownIt({ html: true });

	component.setInputPath("./test/stubs/template-custom-keep.webc");
	component.setTransform("md", async (content) => {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve(md.render(content));
			});
		});
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/template-custom-keep.webc"
	]);
	t.is(html.trim(), `<template><h1>Header</h1>
</template>`);
});

test("Two components using identical <style>", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/two-style.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.is(css.length, 1); // dedupes these: only one CSS entry
	t.deepEqual(css, [`p { color: red; }`]);
	t.deepEqual(components, [
		"./test/stubs/two-style.webc",
		"./test/stubs/components/nested-child-style.webc",
	]);
	t.is(html.trim(), `<web-component>SSR content</web-component>
<web-component>SSR content</web-component>`);
});

test("<style webc:scoped>", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/scoped.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, [`.whukf8ig4 div{color:purple}`]);
	t.deepEqual(components, [
		"./test/stubs/scoped.webc",
		"./test/stubs/components/scoped-style.webc",
	]);
	t.is(html.trim(), `<web-component class="whukf8ig4">
Light dom content</web-component>`);
});

test("<style webc:scoped> selector tests", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/scoped-top.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, [`@font-face{src:url(test.woff)}.w4yaok8y2 div{}.w4yaok8y2 #test{}.w4yaok8y2 :after{}.w4yaok8y2 div:before{}.w4yaok8y2 .class1{}.w4yaok8y2 .class1.class2{}.w4yaok8y2 .class1.class2:after{}`]);
	t.deepEqual(components, [
		"./test/stubs/scoped-top.webc",
	]);
	t.is(html.trim(), `<div class="w4yaok8y2">Testing testing</div>`);
});

test("<style webc:type> instead of webc:scoped", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/style-override.webc");
	component.setTransform("override", (content) => {
		t.is(content, `
@font-face {
	src: url("test.woff");
}
div {}
#test {}
:after {}
div:before {}
.class1 {}
.class1.class2 {}
.class1.class2:after {}
`)
		return `/* This is an override */`;
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, [`/* This is an override */`]);
	t.deepEqual(components, [
		"./test/stubs/style-override.webc",
	]);
	t.is(html.trim(), `<div>Testing testing</div>`);
});

test("<style webc:scoped=\"hashOverride\">", async t => {
	let component = new WebC();
	component.setInputPath("./test/stubs/scoped-override.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, [`.hashOverride div{color:purple}`]);
	t.deepEqual(components, [
		"./test/stubs/scoped-override.webc",
		"./test/stubs/components/scoped-override.webc",
	]);
	t.is(html.trim(), `<web-component class="hashOverride">
Light dom content</web-component>`);
});

test("<style webc:scoped=\"hashOverride\"> with collisions", async t => {
	let component = new WebC();
	component.setInputPath("./test/stubs/scoped-override-collisions.webc");

	await t.throwsAsync(async () => {
		await component.compile()
	})
});

const slotsStubs = {
	"./test/stubs/slot.webc": {
		description: "Default slot",
		slots: {
			default: "hello",
		},
		content: `<div>hello</div>`,
	},

	"./test/stubs/slot-unused.webc": {
		description: "Unused slot content",
		content: `<div></div>`,
	},

	"./test/stubs/slot-unused-default.webc": {
		description: "Unused Slot Content with another default slot",
		slots: {
			default: "hello",
		},
		content: `<div>hello</div>`,
	},

	"./test/stubs/slot-unused-2.webc": {
		description: "Unused Slot Content (multiple) with another default slot",
		slots: {
			default: "hello",
		},
		content: `<div>hello</div>`,
	},

	"./test/stubs/slot-named.webc": {
		description: "Named slots",
		slots: {
			default: "hello",
			slot1: "<p>Testing</p>",
		},
		content: `<div>hello<p>Testing</p></div>`,
	},
	
	"./test/stubs/slot-fallback-content.webc": {
		description: "Slot uses fallback content",
		slots: {},
		content: `<div>Fallback content</div>`,
	},

	"./test/stubs/slot-named-fallback.webc": {
		description: "Named slot has fallback content",
		slots: {
			default: "hello",
		},
		content: `<div>helloFallback content</div>`,
	},
};

for(let filename in slotsStubs) {
	let stub = slotsStubs[filename];
	test(stub.description || filename, async t => {
		let component = new WebC();

		component.setInputPath(filename);
		
		let { html, css, js, components } = await component.compile({
			slots: stub.slots
		});

		t.deepEqual(js, []);
		t.deepEqual(css, []);
		t.deepEqual(components, [ filename ]);
		t.is(html, stub.content);
	});
}

test("<slot webc:raw>", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/slot-raw.webc");
	
	let { html, css, js, components } = await component.compile({
		slots: {
			name1: "Hello",
			default: "Goodbye"
		}
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [ "./test/stubs/slot-raw.webc" ]);
	t.is(html, `<div><slot name="name1">Fallback content</slot></div>`);
});

test("<slot webc:keep>", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/slot-keep.webc");
	
	let { html, css, js, components } = await component.compile({
		slots: {
			name1: "Hello",
			default: "Goodbye",
		}
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [ "./test/stubs/slot-keep.webc" ]);
	t.is(html, `<div><slot name="name1">Hello</slot></div>`);
});

// Note that parse5 returns an extra \n at the end of the <body> element
test("Full page", async t => {
	let page = new WebC();
	page.setInputPath("./test/stubs/page.webc");

	let { html, css, js, components } = await page.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/page.webc"
	]);
	t.is(html, `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="description" content>
	<title></title>
</head>
<body>


</body>
</html>`);
});

/* This can’t exist any more */
test("Component in page mode (error case)", async t => {
	let page = new WebC();
	page.setInputPath("./test/stubs/component-in-page-mode.webc");
	
	let { html, css, js, components } = await page.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/component-in-page-mode.webc"
	]);
	t.is(html, `<div>Test</div>`);
});

async function testGetResultFor(filename, components, slots, data) {
	let component = new WebC();

	component.setInputPath(filename);

	return component.compile({
		slots,
		components,
		data,
	});
}

test("Using a web component without it being declared", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc"
	]);

	// Same output as `webc:raw`
	t.is(html, `Before
<web-component></web-component>
After`);
});

test("Using a web component (skip parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/nested-child.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/nested-child.webc"
	]);
	t.is(html, `Before
SSR content
After`);
});

test("Using a web component with a declarative shadow root", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/shadowroot.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/shadowroot.webc"
	]);
	t.is(html, `Before
<web-component><template shadowroot="open">
	<style>
		b { color: red; }
	</style>
	Hello <b>World</b>!
</template></web-component>
After`);
});

test("Using a web component (use webc:keep to force keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-webc-keep.webc", {
		"web-component": "./test/stubs/components/nested-child.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-webc-keep.webc",
		"./test/stubs/components/nested-child.webc"
	]);
	t.is(html, `Before
<web-component>SSR content</web-component>
After`);
});

test("Using a web component (use webc:raw to keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-webc-raw.webc", {
		"web-component": "./test/stubs/components/nested-child.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-webc-raw.webc"
	]);
	t.is(html, `Before
<web-component></web-component>
After`);
});

test("Using a web component (alias using `webc:is` attribute)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-alias.webc", {
		"web-component": "./test/stubs/components/nested-child.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-alias.webc",
		"./test/stubs/components/nested-child.webc",
	]);
	t.is(html, `Before
SSR content
After`);
});

test("Using a web component (use a <p> with `webc:import`)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/alias-paragraph.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/alias-paragraph.webc",
		"./test/stubs/components/child-root.webc"
	]);
	t.is(html, `Before
<p class="class-a class-b class1 class2">
	SSR content
</p>
After`);
});

test("Using a web component (reference via `webc:import` attribute)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-reference.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-reference.webc",
		"./test/stubs/components/nested-child.webc"
	]);
	t.is(html, `Before
SSR content
After`);
});

test("Two identical `webc:import` attributes", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/import-twice.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/import-twice.webc",
		"./test/stubs/components/nested-child.webc"
	]);
	t.is(html, `Before
SSR content
SSR content
After`);
});

test("Using a web component (reference via `webc:import` and use webc:keep to force keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/import-keep.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/import-keep.webc",
		"./test/stubs/components/nested-child.webc"
	]);
	t.is(html, `Before
<web-component>SSR content</web-component>
After`);
});

test("Using a web component (reference via `webc:import` attribute, aliased using `webc:is` attribute)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-alias-reference.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-alias-reference.webc",
		"./test/stubs/components/nested-child.webc",
	]);
	t.is(html, `Before
SSR content
After`);
});


test("Circular dependencies check (pass)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/child-circular.webc",
		"other-component": "./test/stubs/components/nested-child.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/child-circular.webc",
		"./test/stubs/components/nested-child.webc"
	]);
	t.is(html, `Before
SSR content
After`);
});

test("Circular dependencies check (fail)", async t => {
	await t.throwsAsync(testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/child-circular.webc",
		"other-component": "./test/stubs/components/child-circular2.webc",
	}));
});

test("Using a web component (class attribute merging)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/class-mixins.webc", {
		"web-component": "./test/stubs/components/child-root.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/class-mixins.webc",
		"./test/stubs/components/child-root.webc",
	]);
	t.is(html, `Before
<web-component class="class-a class-b class1 class2">
	SSR content
</web-component>
After`);
});

test("Using a web component (class attribute merging, empty classes)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/empty-class.webc", {
		"web-component": "./test/stubs/components/child-root-empty-class.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/empty-class.webc",
		"./test/stubs/components/child-root-empty-class.webc",
	]);
	t.is(html, `<web-component>
	SSR content
</web-component>`);
});

test("Using a web component (style attribute merging)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/style-merge.webc", {
		"web-component": "./test/stubs/components/root-style.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/style-merge.webc",
		"./test/stubs/components/root-style.webc",
	]);
	t.is(html, `Before
<web-component style="font-weight: normal; font-weight: bold; font-style: italic">
	SSR content
</web-component>
After`);
});

test("Using a web component (skip parent for empty style and empty script)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/nested-child-style-script-both-empty.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/nested-child-style-script-both-empty.webc",
	]);
	t.is(html, `Before

After`);
});

test("Using a web component (keep parent: style)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/nested-child-style.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/nested-child-style.webc",
	]);
	t.is(html, `Before
<web-component>SSR content</web-component>
After`);
});

test("Using a web component with <style webc:keep>", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/nested-child-style-keep.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/nested-child-style-keep.webc",
	]);
	t.is(html, `Before
<web-component>SSR content<style>p { color: red; }</style></web-component>
After`);
});

test("Using a web component (keep parent: script)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/nested-child-script.webc"
	});

	t.deepEqual(js, [`alert("test");`]);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/nested-child-script.webc",
	]);
	t.is(html, `Before
<web-component>SSR content</web-component>
After`);
});

test("Using a web component with a slot (skip parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-content.webc", {
		"web-component": "./test/stubs/components/nested-child-slot.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-content.webc",
		"./test/stubs/components/nested-child-slot.webc",
	]);
	t.is(html, `Before
SSR contentChild contentAfter slot content
After`);
});

test("Using a web component with a slot (keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-content.webc", {
		"web-component": "./test/stubs/components/nested-child-slot-style.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, [
		"./test/stubs/nested-content.webc",
		"./test/stubs/components/nested-child-slot-style.webc",
	]);
	t.is(html, `Before
<web-component>SSR contentChild contentAfter slot content</web-component>
After`);
});

test("Using a web component with a default slot (skip parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-twice.webc", {
		"web-component": "./test/stubs/components/nested-child.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-twice.webc",
		"./test/stubs/components/nested-child.webc",
	]);
	t.is(html, `Before
SSR content
After`);
});

test("Using a web component with a default slot (keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-twice.webc", {
		"web-component": "./test/stubs/components/nested-child-style.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, [
		"./test/stubs/nested-twice.webc",
		"./test/stubs/components/nested-child-style.webc"
	]);
	t.is(html, `Before
<web-component>SSR content</web-component>
After`);
});

test("Using a web component without any shadow dom/foreshadowing (skip parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-no-shadowdom.webc", {
		"web-component-no-foreshadowing": "./test/stubs/components/nested-child-empty.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-no-shadowdom.webc",
		"./test/stubs/components/nested-child-empty.webc"
	]);
	t.is(html, `Before

	Child content
	

After`);
});

test("Using a web component without any shadow dom/foreshadowing (keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-no-shadowdom.webc", {
		"web-component-no-foreshadowing": "./test/stubs/components/nested-child-style-only.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, [
		"./test/stubs/nested-no-shadowdom.webc",
		"./test/stubs/components/nested-child-style-only.webc",
	]);
	t.is(html, `Before
<web-component-no-foreshadowing>
	Child content
	<web-component-no-foreshadowing></web-component-no-foreshadowing>
</web-component-no-foreshadowing>
After`);
});

test("Using a web component with two slots but child has no shadow dom (skip parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-multiple-slots.webc", {
		"web-component": "./test/stubs/components/nested-child-empty.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-multiple-slots.webc",
		"./test/stubs/components/nested-child-empty.webc"
	]);
	t.is(html, `Before

	<p>Before slot content!</p>
	
	
	<p>After slot content!</p>

After`);
});

test("Using a web component with two slots but child has no shadow dom (keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-multiple-slots.webc", {
		"web-component": "./test/stubs/components/nested-child-style-only.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, [
		"./test/stubs/nested-multiple-slots.webc",
		"./test/stubs/components/nested-child-style-only.webc",
	]);
	t.is(html, `Before
<web-component name="World">
	<p>Before slot content!</p>
	
	
	<p>After slot content!</p>
</web-component>
After`);
});

test("Using a web component with two slots and default content (skip parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-multiple-slots.webc", {
		"web-component": "./test/stubs/components/nested-child-namedslot.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-multiple-slots.webc",
		"./test/stubs/components/nested-child-namedslot.webc",
	]);
	t.is(html, `Before
SSR content<p>Slot 1 content</p>After slot content
	<p>Before slot content!</p>
	
	
	<p>After slot content!</p>

After`);
});

test("Using a web component with two slots and default content (keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-multiple-slots.webc", {
		"web-component": "./test/stubs/components/nested-child-namedslot-style.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, [
		"./test/stubs/nested-multiple-slots.webc",
		"./test/stubs/components/nested-child-namedslot-style.webc",
	]);
	t.is(html, `Before
<web-component name="World">SSR content<p>Slot 1 content</p>After slot content
	<p>Before slot content!</p>
	
	
	<p>After slot content!</p>
</web-component>
After`);
});

test("Using a web component with webc:raw to allow client component slots (skip parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-multiple-slots-raw.webc", {
		"web-component": "./test/stubs/components/nested-child-empty.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested-multiple-slots-raw.webc",
		"./test/stubs/components/nested-child-empty.webc"
	]);
	// TODO should this automatically opt-in to keeping the <web-component> parent around?
	// Note the slots are using webc:raw
	t.is(html, `Before

	<p>Before slot content!</p>
	<div slot="slot1"><p>Slot 1 content</p></div>
	<div slot="slot2">
		<!-- ignored -->
		<p>Slot 2 content</p>
	</div>
	<p>After slot content!</p>

After`);
});

test("Using a web component with webc:raw to allow client component slots (keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-multiple-slots-raw.webc", {
		"web-component": "./test/stubs/components/nested-child-style-only.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, [
		"./test/stubs/nested-multiple-slots-raw.webc",
		"./test/stubs/components/nested-child-style-only.webc"
	]);
	t.is(html, `Before
<web-component name="World">
	<p>Before slot content!</p>
	<div slot="slot1"><p>Slot 1 content</p></div>
	<div slot="slot2">
		<!-- ignored -->
		<p>Slot 2 content</p>
	</div>
	<p>After slot content!</p>
</web-component>
After`);
});

test("Components dependency graph ordering", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/components-order.webc", {
		"my-grandparent": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-parent": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-me": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-child": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-aunt": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-sibling": "./test/stubs/components/nested-child-slot-before-after.webc",
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/components-order.webc",
		"./test/stubs/components/nested-child-slot-before-after.webc"
	]);
	t.is(html, `Before
	Before
		Before
			BeforeCHILD CONTENTAfter
		After
		BeforeSIBLING CONTENTAfter
	After
	BeforeAUNT CONTENTAfter
After`);
});

test("Components dependency graph ordering (with CSS/JS)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/components-order.webc", {
		"my-grandparent": "./test/stubs/components/child-css-js-a.webc",
		"my-parent": "./test/stubs/components/child-css-js-c.webc",
		"my-me": "./test/stubs/components/child-css-js-e.webc",
		"my-child": "./test/stubs/components/child-css-js-f.webc",
		"my-aunt": "./test/stubs/components/child-css-js-b.webc",
		"my-sibling": "./test/stubs/components/child-css-js-d.webc",
	});

	t.deepEqual(js, ["/* component-a js */", "/* component-b js */", "/* component-c js */", "/* component-d js */", "/* component-e js */", "/* component-f js */"]);
	t.deepEqual(css, ["/* component-a css */", "/* component-b css */", "/* component-c css */", "/* component-d css */", "/* component-e css */", "/* component-f css */"]);
	t.deepEqual(components, [
		"./test/stubs/components-order.webc",
		"./test/stubs/components/child-css-js-a.webc",
		"./test/stubs/components/child-css-js-b.webc",
		"./test/stubs/components/child-css-js-c.webc",
		"./test/stubs/components/child-css-js-d.webc",
		"./test/stubs/components/child-css-js-e.webc",
		"./test/stubs/components/child-css-js-f.webc",
	]);
	t.is(html, `<my-grandparent>Before
	<my-parent>Before
		<my-me>Before
			<my-child>BeforeCHILD CONTENTAfter</my-child>
		After</my-me>
		<my-sibling>BeforeSIBLING CONTENTAfter</my-sibling>
	After</my-parent>
	<my-aunt>BeforeAUNT CONTENTAfter</my-aunt>
After</my-grandparent>`);
});

test("<script webc:type> with Typescript", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/script-type.webc");
	component.setTransform("ts", async (content) => {
		t.is(content.trim(), `let x: string = "string";`);
		let ret = typescript.transpileModule(content, {
			compilerOptions: {}
		});
		return ret.outputText;
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js.join("").trim(), `var x = "string";`);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/script-type.webc",
	]);
	t.is(html.trim(), ``);
});

test("Scoped styles with :host and :defined", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/defined-style.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, [`.wkkjq9gk1{color:green}.wkkjq9gk1:defined{color:red}`]);
	t.deepEqual(components, [
		"./test/stubs/defined-style.webc",
	]);
	// Scoped class is added to top level node (if one exists)
	t.is(html.trim(), `<div class="wkkjq9gk1">This will be green at first and then switch to red when JS has registered the component.</div>`);
});

// TODO this should throw an error or warning
test.skip("Scoped styles with :host and :defined (no root element)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/defined-style-noroot.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, [`.wkkjq9gk1{color:green}.wkkjq9gk1:defined{color:red}`]);
	t.deepEqual(components, [
		"./test/stubs/defined-style-noroot.webc",
	]);

	// No scoped class is added here!
	t.is(html, `
This will be green at first and then switch to red when JS has registered the component.`);
});

test("Scoped styles with :host and :defined (child component)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/defined-style.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, [`.wkkjq9gk1{color:green}.wkkjq9gk1:defined{color:red}`]);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/defined-style.webc",
	]);

	// Scoped class is added to host element
	t.is(html, `Before
<web-component class="wkkjq9gk1">
<div>This will be green at first and then switch to red when JS has registered the component.</div></web-component>
After`);
});

test("Client-side JS on child component", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/clientside.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/clientside.webc",
	]);

	// Note the <script> here is using webc:keep to stay on the client without aggregating back up to the JS
	t.is(html, `Before
<web-component>This is the web component content.
<script>
customElements.define('web-component', class extends HTMLElement {
	connectedCallback() {
		console.log( "Connected!" );
	}
});
</script></web-component>
After`);
});

test("Using a component attribute inside the component", async t => {
	let { html } = await testGetResultFor("./test/stubs/global-data.webc");

	t.is(html, `<div key="attrValue"></div>`);
});

test("Scripted render function", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/render.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/render.webc",
	]);

	t.is(html, `<div test2="2"></div>
<div parentattribute="test">
This is sample content.
</div>`);
});

test("Using image scripted render function", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/using-img.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/using-img.webc",
		"./test/stubs/components/img.webc",
	]);

	t.is(html, `<img src="my-src.png">`);
});

test("Using scripted render function to generate CSS (webc:root)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/using-css-root.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, [`.wzlbemqff .selector{}`]);
	t.deepEqual(components, [
		"./test/stubs/using-css-root.webc",
		"./test/stubs/components/render-css-root.webc",
	]);

	t.is(html, ``);
});

test("Using scripted render function to generate CSS", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/using-css.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, [`.wjmnc5heg .selector{color:red}`]);
	t.deepEqual(components, [
		"./test/stubs/using-css.webc",
		"./test/stubs/components/render-css.webc",
	]);

	t.is(html, `<some-css class="wjmnc5heg"></some-css>`);
});

test("Using scripted render function to generate CSS with webc:keep", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/using-css-keep.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/using-css-keep.webc",
		"./test/stubs/components/render-css-keep.webc",
	]);

	t.is(html, `<style>/* CSS */</style>`);
});

test("Using image component plain", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/using-img-plain.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/using-img-plain.webc",
		"./test/stubs/components/img-plain.webc",
	]);

	t.is(html, `<img src="my-src.png">`);
});

test("Using img as root mapped to img", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/img-to-img.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/img-to-img.webc",
		"./test/stubs/components/img-as-root.webc",
	]);

	t.is(html, `<img src="my-src.png" class="class1" child-attr>`);
});

test("Using props", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/props.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/props.webc",
		"./test/stubs/components/img-props.webc",
	]);

	t.is(html, `<img src="my-src.png">`);
});

test("Using @html", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/html.webc");

	let { html, css, js, components } = await component.compile({
		data: {
			variable1: "value1"
		}
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/html.webc",
	]);

	t.is(html, `<p>Paragraph HTML</p>
<p>value1</p>
<template>Template HTML</template>
<template>Template HTML Keep</template>
Template HTML Nokeep
`);
});