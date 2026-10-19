import test from "node:test";
import { WebC } from "../webc.js";

test("Server-side comments", async t => {
	let component = new WebC();
	component.setContent(`<!-- include -->Hello<!--- ignore ---><!---- ignore ----><!---ignore---><!-- include -->`);

	let { html } = await component.compile();
	t.assert.strictEqual(html, `<!-- include -->Hello<!-- include -->`);
});