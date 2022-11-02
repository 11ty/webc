import { WebC } from "../../webc.js";

let page = new WebC();

page.setInputPath("page.webc");
page.defineComponents({
	"avatar-image": "components/img.webc",
	"add-banner-to-css": "components/add-banner-to-css.webc"
});

let { html, css, js, components } = await page.compile();
console.log({ html, css, js, components });