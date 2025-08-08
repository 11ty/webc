import path from "node:path";
import test from "ava";
import { WebC } from "../../../webc.js";

test("webc:setup #87", async t => {
	let component = new WebC();

	component.setContent(`<div @html="key"></div>
<script webc:setup>
export const key = 1;

export function alwaysBlue() {
	return "blue";
}
</script>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>1</div>

<div>blue</div>`);
});

test("webc:setup with a helper #87", async t => {
	let component = new WebC();

	component.setHelper("alwaysYellow", () => "yellow");

	component.setContent(`<script webc:setup>
export function alwaysBlue() {
	return alwaysYellow(); // helper
}
</script>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>yellow</div>`);
});

test("webc:setup with global data #87", async t => {
	let component = new WebC();

	component.setHelper("alwaysYellow", () => "yellow");

	component.setContent(`<script webc:setup>
export function alwaysBlue() {
	return $data.globalDataValue; // helper
}
</script>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile({
		data: {
			globalDataValue: "hello"
		}
	});

	t.is(html.trim(), `<div>hello</div>`);
});


test("webc:setup with child component #87", async t => {
	let component = new WebC();
	component.setHelper("globalFunction", (a) => a);

	component.defineComponents("./test/stubs/setup-script/component.webc");

	component.setContent(`<div @html="key"></div>
<script webc:setup>
export const key = 1;

export function alwaysBlue() {
	return "blue";
}
</script>
<component></component>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>1</div>

<div>2</div>

<div>red</div>
<div>blue</div>`);
});

test("webc:setup without export", async t => {
	let component = new WebC();

	component.setContent(`<div @html="key"></div>
<script webc:setup>
const key = 1;
</script>`);

	let { html } = await component.compile();

	// should be empty (no export)
	t.is(html.trim(), `<div></div>`);
});

test("webc:setup with export", async t => {
	let component = new WebC();

	component.setContent(`<div @html="key"></div>
<script webc:setup>
export const key = 1;
</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>1</div>`);
});

test("webc:setup with function (no export)", async t => {
	let component = new WebC();

	component.setContent(`<script webc:setup>
function alwaysBlue() {
	return "blue";
}
</script>
<div @html="alwaysBlue()"></div>`);

	let e = await t.throwsAsync(() => component.compile());
	t.true(e.message.startsWith(`Evaluating a dynamic attribute failed: \`@html="alwaysBlue()"\``));
});

test("webc:setup with function (export)", async t => {
	let component = new WebC();

	component.setContent(`<script webc:setup>
export function alwaysBlue() {
	return "blue";
}
</script>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>blue</div>`);
});

test("webc:setup with import and export", async t => {
	let component = new WebC();

	// Absolute path used here
	component.setInputPath(path.resolve("./test/stubs/setup-script/test.webc"));
	component.setContent(`<script webc:setup>
import fn from "./import-target.js";
export function alwaysBlue() {
	return fn();
}
</script>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>This is imported!</div>`);
});

// TODO swap `export` to `import`
// probably a bug in `import-module-string`
test.skip("webc:setup with import combo export", async t => {
	let component = new WebC();

	// Absolute path used here
	component.setInputPath(path.resolve("./test/stubs/setup-script/test.webc"));
	component.setContent(`<script webc:setup>
export { default as alwaysBlue } from "./import-target.js";
</script>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>This is imported!</div>`);
});

test("webc:setup with encodeURIComponent", async t => {
	let component = new WebC();

	component.setContent(`<script webc:setup>
export function alwaysBlue() {
	return encodeURIComponent("this is a test");
}
</script>
<div @html="alwaysBlue()"></div>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<div>this%20is%20a%20test</div>`);
});