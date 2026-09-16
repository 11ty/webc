import test from "ava";
import { WebC } from "../webc.js";

function getComponent(content) {
	let component = new WebC();
	component.defineComponents("./test/stubs/issue-111/*.webc");
	component.setContent(content);
	return component;
}

test("Nested default slot passes content through #111", async t => {
	let component = getComponent(`<my-paragraph>Hello</my-paragraph>
<paragraph-with-wrapper>Wrapped</paragraph-with-wrapper>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<p>Hello</p>
<div class="with-wrapper"><p>Wrapped</p></div>`);
});

test("Forwarded named slot #111", async t => {
	let component = getComponent(`<my-forwarded-card><b slot="heading">Title</b>Body</my-forwarded-card>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<article><header><b>Title</b></header>Body</article>`);
});

test("Forwarded slot uses its own fallback content #111", async t => {
	let component = getComponent(`<my-forwarded-card></my-forwarded-card>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<article><header></header>Forwarded fallback</article>`);
});

test("Slots forwarded through multiple components #111", async t => {
	let component = getComponent(`<my-deep-card><i slot="h">Title</i>Body</my-deep-card>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<section><article><header><i>Title</i></header>Body</article></section>`);
});

test("Slot in page content renders its fallback #111", async t => {
	let component = getComponent(`<my-card><slot>Page fallback</slot></my-card>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<article><header>No title</header>Page fallback</article>`);
});
