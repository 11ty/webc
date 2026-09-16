import test from "ava";
import { WebC } from "../webc.js";

function getComponent(content) {
	let component = new WebC();
	component.defineComponents("./test/stubs/issue-184/*.webc");
	component.setContent(content);
	return component;
}

test("Indirectly recursive components #184", async t => {
	let component = getComponent(`<dept-list :@depts="depts"></dept-list>`);

	let { html } = await component.compile({
		data: {
			depts: [
				{ name: "A", contains: [{ name: "A1", contains: [{ name: "A1a" }] }] },
				{ name: "B" },
			]
		}
	});

	t.is(html.trim(), `<ul class="dept-list"><li class="dept"><span>A</span><ul class="dept-list"><li class="dept"><span>A1</span><ul class="dept-list"><li class="dept"><span>A1a</span></li></ul></li></ul></li>
<li class="dept"><span>B</span></li></ul>`);
});

test("Component using its own tag renders a plain element #184", async t => {
	let component = getComponent(`<tree-node :@name="'Root'" :@children="tree"></tree-node>`);

	let { html } = await component.compile({
		data: {
			tree: [{ name: "A" }]
		}
	});

	t.is(html.trim(), `<li>Root</li><ul><tree-node></tree-node></ul>`);
});

test("Recursive component nested inside an element #184", async t => {
	let component = getComponent(`<wrapped-node :@name="'1'" :@child="({ name: '2', child: { name: '3' } })"></wrapped-node>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<b>1</b><div><i><b>2</b><div><i><b>3</b></i></div></i></div>`);
});

test("Recursive components without an end condition throw with the component chain #184", async t => {
	let component = getComponent(`<endless-a></endless-a>`);

	await t.throwsAsync(() => component.compile(), {
		message: /Maximum component depth \(512\) exceeded\. Does a recursive component have an end condition\? Component chain: … → (<endless-[ab]> → ){9}<endless-[ab]>$/
	});
});

test("Custom maximum component depth #184", async t => {
	let data = {
		depts: [{ name: "A", contains: [{ name: "A1", contains: [{ name: "A1a" }] }] }]
	};

	let component = getComponent(`<dept-list :@depts="depts"></dept-list>`);
	component.setMaxComponentDepth(5);

	await t.throwsAsync(() => component.compile({ data }), {
		message: "Maximum component depth (5) exceeded. Does a recursive component have an end condition? Component chain: <dept-list> → <dept> → <dept-list> → <dept> → <dept-list> → <dept>"
	});

	component.setMaxComponentDepth(6);
	let { html } = await component.compile({ data });
	t.true(html.includes("A1a"));
});
