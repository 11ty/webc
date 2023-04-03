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
	// component.setContent(`<child>test</child>`);
	component.setContent(`<child><parent><span @text="globalData"></span></parent></child>`);
	component.defineComponents("./test/stubs/issue-152/parent.webc");
	component.defineComponents("./test/stubs/issue-152/child.webc");

	let { html } = await component.compile({
		data: {
			globalData: "Hello"
		}
	});

	t.is(html.trim(), `<h2><h1><span>Hello</span></h1></h2>`);
});
