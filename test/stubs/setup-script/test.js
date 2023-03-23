import test from "ava";
import { WebC } from "../../../webc.js";

test("webc:setup #87", async t => {
	let component = new WebC();

	component.setContent(`<div @html="key"></div>
<script webc:setup>
const key = 1;

function alwaysBlue() {
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
function alwaysBlue() {
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
function alwaysBlue() {
	return globalDataValue; // helper
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
const key = 1;

function alwaysBlue() {
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