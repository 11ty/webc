import test from "ava";
import { WebC } from "../webc.js";

test("webc:import in Components should be relative to component file #78", async t => {
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

test("stock webc:type=js #78", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js">
\`hello\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `hello`);
});

test("stock webc:type=js with template #78", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js" webc:is="template">
\`hello\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `hello`);
});

test("stock webc:type=js with template/keep #78", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js" webc:is="template" webc:keep>
\`hello\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<template>hello</template>`);
});

test("stock webc:type=js with webc:is #78", async t => {
	let component = new WebC();

	component.setContent(`<script webc:type="js" webc:is="ul" webc:keep>
\`<li>test</li>\`;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<ul><li>test</li></ul>`);
});

test("Docs image example #78", async t => {
	let component = new WebC();

	component.setContent(`<img src="my-image.jpeg" alt="An excited Zach is trying to finish this documentation">`);
	component.defineComponents("./test/stubs/issue-78/img.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<img src="my-image.jpeg" alt="An excited Zach is trying to finish this documentation" extra-attribute>`);
});

test("Docs css example #78", async t => {
	let component = new WebC();

	component.setContent(`<add-banner-to-css @license="MIT licensed">
p { color: rebeccapurple; }
</add-banner-to-css>`);
	component.defineComponents("./test/stubs/issue-78/add-banner-to-css.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<style>/* MIT licensed */

p { color: rebeccapurple; }
</style>`);
});

test("Docs css example using wrapper element #78", async t => {
	let component = new WebC();

	component.setContent(`<style webc:is="add-banner-to-css-root" @license="MIT licensed">
p { color: rebeccapurple; }
</style>`);
	component.defineComponents("./test/stubs/issue-78/add-banner-to-css-root.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<style>
/* MIT licensed */

p { color: rebeccapurple; }

</style>`);
});

test("Docs css example using render #78", async t => {
	let component = new WebC();

	component.setContent(`<style webc:is="add-banner-to-css-render" @license="MIT licensed">
p { color: rebeccapurple; }
</style>`);
	component.defineComponents("./test/stubs/issue-78/add-banner-to-css-render.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<style>
	/* MIT licensed */
	
p { color: rebeccapurple; }

</style>`);
});
