import test from "ava";
import { WebC } from "../webc.js";

async function compile(content, data) {
	let component = new WebC();
	component.defineComponents("./test/stubs/issue-214/*.webc");
	component.setContent(content);

	let { html } = await component.compile({ data });
	return html.trim();
}

test("Slotted content uses props of the component that authored it #214", async t => {
	t.is(await compile(`<c-faq @title="FAQ" :@questions="[{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }]"></c-faq>`), `<section><h1>FAQ</h1><details><summary>Q1</summary><p>A1</p></details>
<details><summary>Q2</summary><p>A2</p></details></section>`);
});

test("Slotted content falls back to props of the component rendering the slot #214", async t => {
	t.is(await compile(`<c-card @title="Welcome"><h2 slot="header" @text="title"></h2></c-card>`), `<article><header><h2>Welcome</h2></header></article>`);
	t.is(await compile(`<c-label></c-label>`), `<article><header></header><b>Host</b></article>`);
});

test("Props of the authoring component win over props of the component rendering the slot #214", async t => {
	t.is(await compile(`<c-label @label="Writer"></c-label>`), `<article><header></header><b>Writer</b></article>`);
});

test("Setup data of the authoring component in slotted content #214", async t => {
	t.is(await compile(`<c-setup-only></c-setup-only>`), `<article><header></header><b>Setup</b></article>`);
	t.is(await compile(`<c-setup></c-setup>`), `<article><header></header><b>Setup</b></article>`);
});

test("Loop variables of the authoring component win in slotted content #214", async t => {
	t.is(await compile(`<c-loop :@items="['writer']"></c-loop>`), `<ul><li><b>writer</b></li></ul>`);
});

test("Props in slotted content forwarded through multiple components #214", async t => {
	t.is(await compile(`<c-forward-props @name="Zach"></c-forward-props>`), `<section><h1>Forwarded</h1><i>Zach</i></section>`);
});

test("Recursion through slotted content can end #214", async t => {
	t.is(await compile(`<c-recurse :@n="1"></c-recurse>`), `<b>1</b><article><header></header><b>2</b><article><header></header><b>3</b><article><header></header></article></article></article>`);
});

test("webc:for over an empty value renders nothing", async t => {
	t.is(await compile(`<ul><li webc:for="item of items" @text="item"></li></ul>`, { items: null }), `<ul></ul>`);
});
