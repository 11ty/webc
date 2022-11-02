import { WebC } from "../../webc.js";

let page = new WebC();

page.setInputPath("page.webc");

// Pass in a glob, using the file name as component name
page.defineComponents("components/**.webc");

// Array of file names, using file name as component name
// page.defineComponents(["components/my-component.webc"]);

// Object maps component name to file name
// page.defineComponents({
// 	"my-component": "components/my-component.webc"
// });

let { html } = await page.compile();
console.log({ html });