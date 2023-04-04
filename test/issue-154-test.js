import test from "ava";
import { WebC } from "../webc.js";

test("Style scoping bug #154", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setInputPath("./test/stubs/issue-154/page.webc");
	component.defineComponents("./test/stubs/issue-154/c-red.webc");
	component.defineComponents("./test/stubs/issue-154/c-blue.webc");

	let { html, css } = await component.compile();

	t.deepEqual(css.sort(), [ `.wla6sc-lx{background-color:blue}`, `.wwcxvoco3{background-color:red}` ]);
	t.is(html.trim(), `<div class="wwcxvoco3">Hi I am red</div>


<div class="wla6sc-lx">Hi I am blue</div>




<div class="wwcxvoco3">
I am red.
<div class="wla6sc-lx">Hi I am blue</div>



still red
</div>



<div class="wla6sc-lx">
I am blue.
<div class="wwcxvoco3">Hi I am red</div>


still blue
</div>`);
});