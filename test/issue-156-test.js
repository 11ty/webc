import test from "ava";
import { WebC } from "../webc.js";

test("HTML entities in <style> tags are being encoded #208", async t => {
	let component = new WebC();
	component.defineComponents("./test/stubs/issue-156/link.webc");
	component.setContent(`<link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
<link rel="mask-icon" href="/images/safari-mask-icon.svg" color="#888888">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">`);

		let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./test/stubs/issue-156/link.webc"]);
	t.is(html.trim(), `<link data-test rel="icon" type="image/svg+xml" href="/images/favicon.svg">
<link data-test rel="mask-icon" href="/images/safari-mask-icon.svg" color="#888888">
<link data-test rel="apple-touch-icon" href="/images/apple-touch-icon.png">`);
});