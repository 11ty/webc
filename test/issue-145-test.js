import test from "ava";
import { WebC } from "../webc.js";

test("@keyframes percentage webc:scoped #145", async t => {
	let component = new WebC();

	component.setContent(`<style webc:scoped>
	@keyframes my-anim {
		0% { opacity: 0; }
		100% {  opacity: 1; }
	}
</style>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<style class="w91flqtfm">@keyframes my-anim{0%{opacity:0}100%{opacity:1}}</style>`);
});

test("@keyframes from/to webc:scoped #145", async t => {
	let component = new WebC();

	component.setContent(`<style webc:scoped>
	@keyframes my-anim {
		from { opacity: 0; }
		to {  opacity: 1; }
	}
</style>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<style class="whybzha-i">@keyframes my-anim{from{opacity:0}to{opacity:1}}</style>`);
});