import { WebC } from "../../webc.js";

let page = new WebC();

page.setInputPath("page.webc");

let { html, css, js, components } = await page.compile({
	data: {
		dataProperty: "dataValue",
	},
});
console.log({ html, css, js, components });
