import test from "ava";
import { WebC } from "../../webc.js";

test("Template content issue #105", async t => {
	let component = new WebC();

	component.defineComponents("./test/issue-105/test-p.webc");

	component.setContent(`<template><test-p></test-p></template>`);

	let { html } = await component.compile();

	t.is(html.trim(), `<template><p>I am an HTML-only component</p></template>`);
});