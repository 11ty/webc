import test from "ava";
import { WebC } from "../webc.js";

test("webc:type=js #88", async t => {
	let component = new WebC();

	component.setHelper("alwaysBlue", () => {
		return "I'm blue, da ba dee da ba di";
	});

	component.setContent(`<script webc:type="js">
export default function({ alwaysBlue }) {
	return alwaysBlue(\`hello\`);
}
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `I'm blue, da ba dee da ba di`);
});

test("webc:type=js #88 (with `this`)", async t => {
	let component = new WebC();

	component.setHelper("alwaysBlue", () => {
		return "I'm blue, da ba dee da ba di";
	});

	component.setContent(`<script webc:type="js">
export default function() {
	return this.alwaysBlue(\`hello\`);
}
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `I'm blue, da ba dee da ba di`);
});


test("webc:type=render #88", async t => {
	let component = new WebC();

	component.setHelper("alwaysBlue", () => {
		return "I'm blue, da ba dee da ba di";
	});

	component.setContent(`<script webc:type="render">
export default function() {
	return this.alwaysBlue(\`hello\`);
}
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `I'm blue, da ba dee da ba di`);
});
