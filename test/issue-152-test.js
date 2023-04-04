import test from "ava";
import { WebC } from "../webc.js";

test("Slotted global data access #152", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<parent>Hello I am in the default slot.<span @text="globalData"></span></parent>`);
	component.defineComponents("./test/stubs/issue-152/parent.webc");

	let { html } = await component.compile({
		data: {
			globalData: "Hello"
		}
	});

	t.is(html.trim(), `<h1>Hello I am in the default slot.<span>Hello</span></h1>`);
});

test("Slotted global data access nested #152", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<parent><child><span @text="globalData"></span></child></parent>`);
	component.defineComponents("./test/stubs/issue-152/parent.webc");
	component.defineComponents("./test/stubs/issue-152/child.webc");

	let { html } = await component.compile({
		data: {
			globalData: "Hello"
		}
	});

	t.is(html.trim(), `<h1><h2><span>Hello</span></h2></h1>`);
});

test("Slotted global data access even more nested #152", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<parent><child><child><span @text="globalData"></span></child></child></parent>`);
	component.defineComponents("./test/stubs/issue-152/parent.webc");
	component.defineComponents("./test/stubs/issue-152/child.webc");

	let { html } = await component.compile({
		data: {
			globalData: "Hello"
		}
	});

	t.is(html.trim(), `<h1><h2><h2><span>Hello</span></h2></h2></h1>`);
});

test("Slotted global data access parent without slot #152", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<parent-nohtml><child><span @text="globalData"></span></child></parent-nohtml>`);
	component.defineComponents("./test/stubs/issue-152/parent-nohtml.webc");
	component.defineComponents("./test/stubs/issue-152/child.webc");

	let { html } = await component.compile({
		data: {
			globalData: "Hello"
		}
	});

	t.is(html.trim(), `<h2><span>Hello</span></h2>`);
});

test("Slotted global data access parent without slot even nestier #152", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<parent-nohtml><child><child><span @text="globalData"></span></child></child></parent-nohtml>`);
	component.defineComponents("./test/stubs/issue-152/parent-nohtml.webc");
	component.defineComponents("./test/stubs/issue-152/child.webc");

	let { html } = await component.compile({
		data: {
			globalData: "Hello"
		}
	});

	t.is(html.trim(), `<h2><h2><span>Hello</span></h2></h2>`);
});
