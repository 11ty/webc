import { WebC } from "../../webc.js";

let page = new WebC();

page.setInputPath("page.webc");
page.defineComponents("components/my-component.webc");

let { html } = await page.compile();
console.log({ html });
