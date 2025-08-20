import test from "ava";
import { WebC } from "../webc.js";

test("HTML entities in <style> tags are being encoded #208", async t => {
	let component = new WebC();
	component.setContent(`<script webc:setup>
export const cssString = "article > h1 { background: red; }";
</script>
<style webc:keep @text="cssString"></style>
<style webc:keep @raw="cssString"></style>
<style webc:keep @html="cssString"></style>`);

		let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html.trim(), `<style>article &gt; h1 { background: red; }</style>
<style>article > h1 { background: red; }</style>
<style>article > h1 { background: red; }</style>`);
});

test("HTML entities in <style> tags are being encoded (bundler mode) #208", async t => {
	let component = new WebC();
	component.setBundlerMode(true);
	component.setContent(`<script webc:setup>
export const cssString = "article > h1 { background: red; }";
</script>
<style webc:keep @text="cssString"></style>
<style webc:keep @raw="cssString"></style>
<style webc:keep @html="cssString"></style>`);

		let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);
	t.is(html.trim(), `<style>article &gt; h1 { background: red; }</style>
<style>article > h1 { background: red; }</style>
<style>article > h1 { background: red; }</style>`);
});

test("Escaping in <style> bug (file component, bundler mode) #208", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setInputPath("./test/stubs/issue-208/page.webc");

	let { html, css } = await component.compile();

	t.deepEqual(css, []);
	t.is(html.trim(), `<style>article &gt; h1 { background: red; }</style>
<style>article > h1 { background: red; }</style>
<style>article > h1 { background: red; }</style>`);
});