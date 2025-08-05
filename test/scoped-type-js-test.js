import test from "ava";
import { WebC } from "../webc.js";

test("webc:scoped with webc:type=js", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<script webc:type="js" webc:is="style" webc:scoped>
export default \`div { color: red; }\`;
</script>`);

	let { html, css } = await component.compile();

	t.is(html.trim(), "");
	t.deepEqual(css, [".wnqfewpis div{color:red}"]);
});


test("webc:scoped webc:keep with webc:type=js", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<script webc:type="js" webc:is="style" webc:keep webc:scoped>
export default \`div { color: red; }\`;
</script>`);

	let { html, css } = await component.compile();

	t.is(html.trim(), `<style class="wnqfewpis">.wnqfewpis div{color:red}</style>`);
	t.deepEqual(css, []);
});

test("webc:scoped webc:keep with webc:type=js with wrapper element", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<div>
<script webc:type="js" webc:is="style" webc:keep webc:scoped>
export default \`div { color: red; }\`;
</script>
</div>`);

	await t.throwsAsync(async () => component.compile(), {
		message: "Could not find any top level <style webc:scoped> in component: _webc_raw_input_string"
	});
});

test("nested content, style from a webc:type=js", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<script webc:type="js" webc:is="template">
export default \`<style>div { color: red; }</style>\`;
</script>`);

	let { html, css } = await component.compile();

	t.is(html.trim(), ``);
	t.deepEqual(css, ["div { color: red; }"]);
});

test("nested content, style webc:scoped from a webc:type=js", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<script webc:type="js" webc:is="template">
export default \`<style webc:scoped>div { color: red; }</style>\`;
</script>`);

	await t.throwsAsync(async () => component.compile(), {
		message: "Could not find any top level <style webc:scoped> in component: _webc_raw_input_string"
	});
});

test("throwing an Error works as expected, issue #99 #100", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<script webc:type="js">throw new Error('Custom error message');</script>`);

	await t.throwsAsync(async () => component.compile(), {
		message: `Check the webc:type="js" element in _webc_raw_input_string
Original error message: Custom error message`
	});
});

test("JavaScript built-ins, issue #99 #100", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<script webc:type="js">export default parseInt("10")</script>`);

	let { html } = await component.compile();

	t.is(html.trim(), `10`);
});