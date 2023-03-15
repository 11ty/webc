import test from "ava";
import { WebC } from "../webc.js";

test("Throw a better error message when attempting to use `class` in dynamic attributes without this #45", async (t) => {
	let component = new WebC();
	component.setContent(`<div :class="class"></div>`);
	component.setInputPath("./test/stubs/component-script-html.webc");

	await t.throwsAsync(component.compile({
		data: {
			class: "test-class"
		}
	}), {
		message: `Evaluating a dynamic attribute failed: \`:class="class"\`. \`class\` is a reserved word in JavaScript. Change \`class\` to \`this.class\` instead!`
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
	t.is(html, `<div class="static value"></div>`);
});
