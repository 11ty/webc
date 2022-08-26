import test from "ava";
import { WebC } from "../webc.js";

test("Raw Input", async t => {
	let component = new WebC();
	component.setInput(`<div class="red"></div>`);

	let html = await component.toHtml();

	t.is(html.trim(), `<div class="red"></div>`);
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

	"./test/stubs/template.webc": {
		description: "Using a top level <template>",
		content: `<template>
	<div class="test"></div>
</template>`,
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
		content: `<style></style>`,
	},

	"./test/stubs/style-clean-attrs.webc": {
		description: "Remove superfluous type=\"text/css\" attribute",
		content: `<style></style>`,
	},
};

for(let filename in fileInputStubs) {
	let stub = fileInputStubs[filename]
	test(stub.description || filename, async t => {
		let component = new WebC();
		
		component.setInputPath(filename);
		
		let html = await component.toHtml();
		
		t.is(html.trim(), stub.content);
	});
}

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
		
		let html = await component.toHtml({
			slots: stub.slots
		});

		t.is(html.trim(), stub.content);
	});
}

const pageStubs = {
	// Note that parse5 returns an extra \n at the end of the <body> element
	"./test/stubs/page.webc": {
		description: "Full page",
		content: `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="description" content="">
	<title></title>
</head>
<body>


</body>
</html>`,
	},

	// WARNING: this returns quirks mode parsing
	"./test/stubs/component-in-page-mode.webc": {
		description: "Component in page mode (error case)",
		content: `<html>
<head></head><body><div>Test</div></body>
</html>`,
	},
};

for(let filename in pageStubs) {
	let stub = pageStubs[filename];
	test(stub.description || filename, async t => {
		let page = new WebC({ mode: "page" });

		page.setInputPath(filename);
		
		let html = await page.toHtml({
			slots: stub.slots
		});

		t.is(html.trim(), stub.content);
	});
}

const nestedStubs = {
	"Using a web component": {
		filename: "./test/stubs/nested.webc",
		components: {
			"web-component": "./test/stubs/nested-child.webc",
		},
		content: `Before
<web-component>SSR content</web-component>
After`,
	},

	"Using a web component with a default slot": {
		filename: "./test/stubs/nested-twice.webc",
		components: {
			"web-component": "./test/stubs/nested-child.webc",
		},
		content: `Before
<web-component>SSR content</web-component>
After`,
	},

	"Using a web component without any shadow dom/foreshadowing": {
		filename: "./test/stubs/nested-no-shadowdom.webc",
		components: {
			"web-component": "./test/stubs/nested-child.webc",
			"web-component-no-foreshadowing": "./test/stubs/nested-child-empty.webc",
		},
		content: `Before
<web-component-no-foreshadowing>
	Child content
	<web-component-no-foreshadowing></web-component-no-foreshadowing>
</web-component-no-foreshadowing>
After`,
	},

	"Using a web component with a slot": {
		filename: "./test/stubs/nested-content.webc",
		components: {
			"web-component": "./test/stubs/nested-child-slot.webc",
		},
		content: `Before
<web-component>SSR contentChild contentAfter slot content</web-component>
After`,
	},

	"Using a web component with two slots and default content": {
		filename: "./test/stubs/nested-multiple-slots.webc",
		components: {
			"web-component": "./test/stubs/nested-child-namedslot.webc",
		},
		content: `Before
<web-component name="World">SSR content<p>Slot 1 content</p>After slot content
	<p>Before slot content!</p>
	
	
	<p>After slot content!</p>
</web-component>
After`,
	},

	"Using a web component with two slots but child has no shadow dom": {
		filename: "./test/stubs/nested-multiple-slots.webc",
		components: {
			"web-component": "./test/stubs/nested-child-empty.webc",
		},
		content: `Before
<web-component name="World">
	<p>Before slot content!</p>
	
	
	<p>After slot content!</p>
</web-component>
After`,
	},

	"Using a web component with webc:raw to allow client component slots": {
		filename: "./test/stubs/nested-multiple-slots-raw.webc",
		components: {
			"web-component": "./test/stubs/nested-child-empty.webc",
		},
		content: `Before
<web-component name="World">
	<p>Before slot content!</p>
	<div slot="slot1"><p>Slot 1 content</p></div>
	<div slot="slot2">
		<!-- ignored -->
		<p>Slot 2 content</p>
	</div>
	<p>After slot content!</p>
</web-component>
After`,
	},
};

async function getComponents(map) {
	let components = {};
	for(let name in map) {
		components[name] = await WebC.getASTFromFilePath(map[name]);
	}
	return components;
}

for(let description in nestedStubs) {
	let stub = nestedStubs[description];
	test(description || stub.filename, async t => {
		let component = new WebC();

		component.setInputPath(stub.filename);

		let components = await getComponents(stub.components);

		let html = await component.toHtml({
			slots: stub.slots,
			components,
		});

		t.is(html.trim(), stub.content);
	});
}