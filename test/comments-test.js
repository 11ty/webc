import test from "ava";
import { WebC } from "../webc.js";

test("Server-side comments", async t => {
	let component = new WebC();
	component.setContent(`<!-- include -->Hello<!--- ignore ---><!---- ignore ----><!---ignore---><!-- include -->`);

	let { html } = await component.compile();
	t.is(html, `<!-- include -->Hello<!-- include -->`);
});