import test from "ava";
import { WebC } from "../webc.js";
import MarkdownIt from "markdown-it";

test("Raw Input", async t => {
	let component = new WebC();
	component.setInput(`<div class="red"></div>`);

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html, `<div class="red"></div>`);
});

test("No Quirks mode default", async t => {
	let component = new WebC();
	component.setInput(`<div class="red"></div>`);

	let ast = await component.getAST();

	t.is("no-quirks", ast.mode);
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

	"./test/stubs/style-clean-attrs.webc": {
		description: "Remove superfluous type=\"text/css\" attribute",
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
		t.deepEqual(components, []);

		t.is(html.trim(), stub.content);
	});
}

test("Using a top level <template>", async t => {
	let component = new WebC();
	
	component.setInputPath("./test/stubs/template.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html.trim(), `<template>
	<div class="test"></div>
</template>`);
});

test("Using a custom <template> type", async t => {
	let component = new WebC();
	let md = new MarkdownIt();

	component.setInputPath("./test/stubs/template-custom.webc");
	component.addCustomTransform("md", (content) => {
		return md.render(content);
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html.trim(), `<h1>Header</h1>`);
});

test("Using a custom <template> type with webc:keep", async t => {
	let component = new WebC();
	let md = new MarkdownIt();

	component.setInputPath("./test/stubs/template-custom-keep.webc");
	component.addCustomTransform("md", (content) => {
		return md.render(content);
	});

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html.trim(), `<template><h1>Header</h1>
</template>`);
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
		t.deepEqual(components, []);
		t.is(html, stub.content);
	});
}

// Note that parse5 returns an extra \n at the end of the <body> element
test("Full page", async t => {
	let page = new WebC({ mode: "page" });

	page.setInputPath("./test/stubs/page.webc");
	
	let { html, css, js, components } = await page.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html, `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="description" content="">
	<title></title>
</head>
<body>


</body>
</html>`);
});

// WARNING: this returns quirks mode parsing
test("Component in page mode (error case)", async t => {
	let page = new WebC({ mode: "page" });

	page.setInputPath("./test/stubs/component-in-page-mode.webc");
	
	let { html, css, js, components } = await page.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html, `<html>
<head></head><body><div>Test</div></body>
</html>`);
});

async function testGetComponents(map) {
	let components = {};
	for(let name in map) {
		components[name] = await WebC.getASTFromFilePath(map[name]);
	}
	return components;
}

async function testGetResultFor(filename, components, slots) {
	let component = new WebC();

	component.setInputPath(filename);

	return component.compile({
		slots,
		components: await testGetComponents(components),
	});
}

test("Using a web component without it being declared", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc");

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);

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
	t.deepEqual(components, ["web-component"]);
	t.is(html, `Before
SSR content
After`);
});

test("Using a web component (use webc:keep to force keep parent)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-webc-keep.webc", {
		"web-component": "./test/stubs/components/nested-child.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, []);
	t.is(html, `Before
<web-component></web-component>
After`);
});

test("Using a web component (alias using `web:is` attribute)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested-alias.webc", {
		"web-component": "./test/stubs/components/nested-child.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component", "other-component"]);
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

test("Using a web component (class attribute mixins)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/class-mixins.webc", {
		"web-component": "./test/stubs/components/child-root.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["web-component"]);
	t.is(html, `Before
<web-component class="class-a class-b class1 class2">
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
	t.deepEqual(components, ["web-component"]);
	t.is(html, `Before

After`);
});

test("Using a web component (keep parent: style)", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/nested-child-style.webc"
	});

	t.deepEqual(js, []);
	t.deepEqual(css, ["p { color: red; }"]);
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component-no-foreshadowing"]);
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
	t.deepEqual(components, ["web-component-no-foreshadowing"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["web-component"]);
	// TODO should this opt-in to keeping the <web-component> parent around?
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
	t.deepEqual(components, ["web-component"]);
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
	t.deepEqual(components, ["my-grandparent", "my-aunt", "my-parent", "my-sibling", "my-me", "my-child"]);
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
	t.deepEqual(components, ["my-grandparent", "my-aunt", "my-parent", "my-sibling", "my-me", "my-child"]);
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