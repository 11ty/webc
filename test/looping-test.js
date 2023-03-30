import test from "ava";
import { WebC } from "../webc.js";

test("Basic webc:for (complex key) over Array", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/array.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<div>2-1</div>
<div>3-2</div>
<div>4-3</div>`);
});

test("Basic webc:for (simple key) over Array", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/array-value.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<div>2-undefined</div>
<div>3-undefined</div>
<div>4-undefined</div>`);
});

test("webc:for over Array has injected data available on child nodes", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/scoped-data.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<div><div>1-0</div></div>
<div><div>2-1</div></div>
<div><div>3-2</div></div>
<div><div>4-3</div></div>`);
});


test("Basic webc:for (complex key) over Object", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/object.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<div>a-1-0</div>
<div>c-4-2</div>`);
});

test("Basic webc:for (simple key) over Object", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/object-key.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<div>a-undefined</div>
<div>c-undefined</div>`);
});

test("webc:for using Object.keys to convert to Array", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/array-object-keys.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<div>a</div>
<div>c</div>`);
});

test("webc:for using Object.values to convert to Array", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/array-object-values.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<div>1</div>
<div>4</div>`);
});

test("webc:for issue #139", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/issue-139.webc");
	component.defineComponents("./test/stubs/looping/components/component.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<b>1</b>
<b>2</b>
<b>3</b>
<b>1</b>
<b>2</b>
<b>3</b>`);
});

test("script webc:setup feeds data for looping", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/looping/script-setup-data.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<b>1</b>
<b>2</b>
<b>3</b>`);
});
