import test from "ava";
import { WebC } from "../webc.js";

test("webc:import in Components should be relative to component file #79", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-78/page.webc");
	component.defineComponents("./test/stubs/issue-78/a-component.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<p>normal component</p>
woah i am component. i do things.

<p>js</p>
<p>hi</p>

<p>js with component</p>
woah i am component. i do things.`);
});


test("stock webc:type=js #79", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js">
\`hello\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `hello`);
});

test("stock webc:type=js with template #79", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js" webc:is="template">
\`hello\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `hello`);
});

test("stock webc:type=js with template/keep #79", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js" webc:is="template" webc:keep>
\`hello\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<template>hello</template>`);
});

test("stock webc:type=js with webc:is #79", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js" webc:is="ul" webc:keep>
\`<li>test</li>\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<ul><li>test</li></ul>`);
});
