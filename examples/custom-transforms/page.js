import MarkdownIt from "markdown-it";
import { WebC } from "../../webc.js";

let page = new WebC();

page.setInputPath("page.webc");

let md = new MarkdownIt({ html: true });

page.setTransform("md", (content) => {
	return md.render(content);
});

let { html, css, js, components } = await page.compile();
console.log({ html, css, js, components });