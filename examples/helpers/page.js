import { WebC } from "../../webc.js";

let page = new WebC();

page.setInputPath("page.webc");
page.setHelper("alwaysBlue", () => {
	return "I'm blue, da ba dee da ba di"
});

let { html, css, js, components } = await page.compile();
console.log({ html, css, js, components });
