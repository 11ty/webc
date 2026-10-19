import test from "node:test";
import { CssPrefixer } from "../src/css.js";

test("Selector tests", t => {
	let c = new CssPrefixer("my-prefix");
	
	t.assert.strictEqual(c.process(""), "");
	t.assert.strictEqual(c.process("div {}"), ".my-prefix div{}");
	t.assert.strictEqual(c.process("* {}"), ".my-prefix *{}"); /* huh? */
	t.assert.strictEqual(c.process("*.warning {}"), ".my-prefix *.warning{}");
	t.assert.strictEqual(c.process("* [lang^=en] {}"), ".my-prefix * [lang^=en]{}");
	t.assert.strictEqual(c.process(":before {}"), ".my-prefix :before{}");
});

test("Class, sibling selectors", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(".class1 {}"), ".my-prefix .class1{}");
	t.assert.strictEqual(c.process(".class1 + .class2 {}"), ".my-prefix .class1+.class2{}");
	t.assert.strictEqual(c.process(".class1 ~ .class2 {}"), ".my-prefix .class1~.class2{}");
});

test("ID selectors", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process("#test {}"), ".my-prefix #test{}");
});

test("Attribute selectors", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process("[class~=class_name] {}"), ".my-prefix [class~=class_name]{}");
	t.assert.strictEqual(c.process("a[title] {}"), ".my-prefix a[title]{}");
	t.assert.strictEqual(c.process(`a[href$=".org"] {}`), `.my-prefix a[href$=".org"]{}`);
	t.assert.strictEqual(c.process(`a[href^="https"][href$=".org"] {}`), `.my-prefix a[href^="https"][href$=".org"]{}`);
	t.assert.strictEqual(c.process(`div[lang|="zh"] {}`), `.my-prefix div[lang|="zh"]{}`);
});

test("List selectors", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`span, div {}`), `.my-prefix span,.my-prefix div{}`);
	t.assert.strictEqual(c.process(`h1,h2, h3, h4 ,h5, h6 {}`), `.my-prefix h1,.my-prefix h2,.my-prefix h3,.my-prefix h4,.my-prefix h5,.my-prefix h6{}`);
	t.assert.strictEqual(c.process(`h1, h2:maybe-unsupported, h3 { font-family: sans-serif }`), `.my-prefix h1,.my-prefix h2:maybe-unsupported,.my-prefix h3{font-family:sans-serif}`);
	t.assert.strictEqual(c.process(`:is(h1, h2:maybe-unsupported, h3) { font-family: sans-serif }`), `.my-prefix :is(h1,h2:maybe-unsupported,h3){font-family:sans-serif}`);
	t.assert.strictEqual(c.process(`:is(h1, :not(h2), h3) { font-family: sans-serif }`), `.my-prefix :is(h1,:not(h2),h3){font-family:sans-serif}`);
});

test("Descendent selectors", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`li li {}`), `.my-prefix li li{}`);
	t.assert.strictEqual(c.process(`li > li {}`), `.my-prefix li>li{}`);
});

test("Pseudo classes", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`:not(p) {}`), `.my-prefix :not(p){}`);
	t.assert.strictEqual(c.process(`div:not([lang]) {}`), `.my-prefix div:not([lang]){}`);

	t.assert.strictEqual(c.process(`li:first-of-type li {}`), `.my-prefix li:first-of-type li{}`);
	t.assert.strictEqual(c.process(`:hover {}`), `.my-prefix :hover{}`);
	t.assert.strictEqual(c.process(`:lang(en-US) {}`), `.my-prefix :lang(en-US){}`);
	t.assert.strictEqual(c.process(`:empty {}`), `.my-prefix :empty{}`);
	t.assert.strictEqual(c.process(`a:has(> img) {}`), `.my-prefix a:has(>img){}`);

	t.assert.strictEqual(c.process(`:host {}`), `.my-prefix{}`);
	t.assert.strictEqual(c.process(`:host:not(p) div {}`), `.my-prefix:not(p) div{}`);
	t.assert.strictEqual(c.process(`:host.footer div {}`), `.my-prefix.footer div{}`); // same as :host(.footer)

	t.assert.strictEqual(c.process(`:host(.footer) div {}`), `.my-prefix.footer div{}`);
	t.assert.strictEqual(
		c.process(`:host(.footer:not([lang])) .link {}`),
		`.my-prefix.footer:not([lang]) .link{}`
	);
	t.assert.strictEqual(
		c.process(`:host(:is(div, span)) {}`),
		`.my-prefix:is(div,span){}`
	);

	t.assert.strictEqual(c.process(`:host-context(html) div {}`), `html .my-prefix div{}`);
	t.assert.strictEqual(
		c.process(`:host-context(html body.dark-theme) div {}`),
		`html body.dark-theme .my-prefix div{}`
	);
	t.assert.strictEqual(
		c.process(`:host-context(html body:is(.dark-theme, .light-theme)) div {}`),
		`html body:is(.dark-theme,.light-theme) .my-prefix div{}`
	);
});

test("Pseudo elements", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`:before {}`), `.my-prefix :before{}`);
	t.assert.strictEqual(c.process(`::before {}`), `.my-prefix ::before{}`);
});

test("@keyframes", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`@keyframes slidein {
	from {
		transform: translateX(0%);
	}

	to {
		transform: translateX(100%);
	}
}`), `@keyframes slidein{from{transform:translateX(0%)}to{transform:translateX(100%)}}`);
});

test("@font-face", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`@font-face {
	font-family: "Open Sans";
	src: url("/fonts/OpenSans-Regular-webfont.woff2") format("woff2");
}`), `@font-face{font-family:"Open Sans";src:url(/fonts/OpenSans-Regular-webfont.woff2)format("woff2")}`);
});

test("@media (min-width)", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`@media (min-width: 20em) {
	div { color: red; }
}`), `@media (min-width:20em){.my-prefix div{color:red}}`);
});

test.skip("lch() color, Issue #82", t => {
	let c = new CssPrefixer("my-prefix");
	t.assert.strictEqual(c.process(`div { color: lch(97% 44.2 240); }`), `.my-prefix div{color:lch(97% 44.2 240)}`);

	t.assert.strictEqual(CssPrefixer.processWithoutTransformation(`div { color: lch(67.5345% 42.5 258.2); }`), `div{color:lch(67.5345% 42.5 258.2)}`);
});

test("@supports selector(*) issue #232", t => {
	let c = new CssPrefixer("my-prefix");

	t.assert.strictEqual(c.process(`@supports selector(*) {
	div { color: red; }
}`), `@supports selector(*){.my-prefix div{color:red}}`);
});
