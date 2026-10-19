import test from "node:test";
import { WebC } from "../webc.js";

test("Using this.class in an attribute #45", async (t) => {
	let component = new WebC();
	component.setContent(`<div :class="this.class"></div>`);
	component.setInputPath("./test/stubs/component-script-html.webc");

	let { html } = await component.compile({
		data: {
			class: "test-class"
		}
	});
	t.assert.strictEqual(html, `<div class="test-class"></div>`);
});

test("Throw a better error message when attempting to use `class` in dynamic attributes without this #45", async (t) => {
	let component = new WebC();
	component.setContent(`<div :class="class"></div>`);
	component.setInputPath("./test/stubs/component-script-html.webc");

	await t.assert.rejects(component.compile({
		data: {
			class: "test-class"
		}
	}), {
		message: 'Error parsing dynamic attribute failed: `:class="class"`. `class` is a reserved word in JavaScript. Change `class` to `this.class` instead!'
	});
});

test("Real class in dynamic attributes #45", async (t) => {
	let component = new WebC();
	component.setContent(`<div :class="(class { static toString() { return 'static value' } })"></div>`);
	component.setInputPath("./test/stubs/component-script-html.webc");

	let { html } = await component.compile({
		data: {
			class: "test-class"
		}
	});
	t.assert.strictEqual(html, `<div class="static value"></div>`);
});

test("Using Math!", async (t) => {
	let component = new WebC();
	component.setContent(`<div :class="Math.random()"></div>`);

	let { html } = await component.compile();
	t.assert.ok(html.startsWith(`<div class="`));
	t.assert.ok(html.endsWith(`"></div>`));

	let num = parseFloat(html.slice(`<div class="`.length, -1 * `"></div>`.length), 10);
	t.assert.strictEqual(typeof NaN, "number");
	t.assert.strictEqual(typeof num, "number");
	t.assert.ok(!isNaN(num));
});
