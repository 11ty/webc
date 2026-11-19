import test from "node:test";
import { WebC } from "../webc.js";

for(let prop of ["@html", "@raw", "@text"]) {
	test(`webc:scoped with ${prop} #58`, async t => {
		let component = new WebC();
		component.setBundlerMode(true);
		component.setContent(`<style webc:scoped ${prop}="\`:host { color: red; } div { color: blue; }\`"></style><div></div>`);

		let { html, css } = await component.compile();

		t.assert.strictEqual(html.trim(), `<div class="w47deqpj8"></div>`);
		t.assert.deepStrictEqual(css, [".w47deqpj8{color:red}.w47deqpj8 div{color:blue}"]);
	});
}
