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

test("nesting webc:for over component hierarchy", async t => {
	let component = new WebC();
	let {contacts} = await import("./stubs/looping/complex/data.js");

	component.defineComponents("./test/stubs/looping/components/*.webc");
	component.setInputPath("./test/stubs/looping/complex/entry-point.webc");

	let { html } = await component.compile({data:{contacts}});
	
	t.true(html.indexOf(`<button onclick="alert('Hello Monica')">Say hello</button>`) > -1)
	t.true(html.indexOf(`<li>Ross - 1</li>`) > -1)
	t.true(html.indexOf(`<div style="border-color:violet">`) > -1)
	t.true(html.indexOf(`<div>Chandler</div>`) > -1)
	t.true(html.indexOf(`border: 1px solid green;`) > -1)
});

test("script webc:for over a Set", async t => {
	let component = new WebC();
	component.setContent('<div webc:for="value of $data.source" @text="value"></div>');

	let { html } = await component.compile({
		data: {
			source: new Set([1,2,3]),
			// source: [1,2,3],
		}
	});

	t.is(html.trim(), `<div>1</div>
<div>2</div>
<div>3</div>`);
});

test("script webc:for over a Map", async t => {
	let component = new WebC();
	component.setContent('<div webc:for="(value) of $data.source" @text="value"></div>');

	let source = new Map();
	source.set("first", 1);
	source.set("second", 2);
	source.set("third", 3);

	let { html } = await component.compile({
		data: {
			source,
		}
	});

	t.is(html.trim(), `<div>first,1</div>
<div>second,2</div>
<div>third,3</div>`);
});

test("Nested script webc:for #175", async t => {
	let component = new WebC();
	component.setContent('<div webc:for="(value, index) of $data.source">outer:<b @text="`${value}`"></b><i webc:for="inner of value"><span @text="`${typeof inner} ${inner}`"></span></i></div>');

	let source = [["1"], ["2a", "2b"], "3"];

	let { html } = await component.compile({
		data: {
			source,
		}
	});

	t.is(html.trim(), `<div>outer:<b>1</b><i><span>string 1</span></i></div>
<div>outer:<b>2a,2b</b><i><span>string 2a</span></i>
<i><span>string 2b</span></i></div>
<div>outer:<b>3</b><i><span>string 3</span></i></div>`);
});

test("Test case from #175 nested webc:for", async t => {
	let component = new WebC();
	component.setContent('<c-data-table :@columns="columns" :@items="users"></c-data-table>');
	component.defineComponents("./test/stubs/issue-175/c-data-table.webc");

	let source = {
		users: [
			{
				id: 1,
				name: 'Alex',
				email: 'alex@example.com'
			},
			{
				id: 2,
				name: 'Bob',
				email: 'bob@example.com'
			},
			{
				id: 3,
				name: 'Steave',
				email: 'steave@example.com'
			}
		],

		columns: ['id', 'name', 'email']
	};

	let { html } = await component.compile({
		data: source,
	});

	t.is(html.trim(), `<table>
<tbody>
<tr>
<td>1</td>
<td>Alex</td>
<td>alex@example.com</td>
</tr>
<tr>
<td>2</td>
<td>Bob</td>
<td>bob@example.com</td>
</tr>
<tr>
<td>3</td>
<td>Steave</td>
<td>steave@example.com</td>
</tr>
</tbody>
</table>`);
});