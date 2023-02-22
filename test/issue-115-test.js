import test from "ava";
import { WebC } from "../webc.js";

test("New line at beginning issue #115", async t => {
	let component = new WebC();

	component.setInputPath("./test/stubs/issue-115/page.webc");

	let { html } = await component.compile();

	t.is(html.trim(), `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test</title>
  </head>
  <body>
    <h1>Hi, this is a test</h1>
  

</body>
</html>`);
});
