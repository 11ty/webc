import { WebC } from "../../webc.js";

let page = new WebC();

page.setInputPath("page.webc");

let { html, css, js } = await page.stream();

// html stream
await printStream(html);

// css stream
await printStream(css);

// js stream
await printStream(js);

async function printStream(stream) {
	const chunks = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.from(chunk));
	}
	console.log(Buffer.concat(chunks).toString("utf-8"));
}