import test from "ava";
import { ProxyData } from "../src/proxyData.cjs";

test("Data is proxied", t => {
	let p = new ProxyData();
	p.addTarget({
		global1: 1,
		global2: 2,
	});

	let data = p.getData();

	t.is(data.global1, 1);
	t.is(data.global2, 2);
});

test("Data is cascaded", t => {
	let p = new ProxyData();
	p.addTarget({
		global1: 3,
		global2: 4,
		global3: 5,
	});
	// later additions override previous additions
	p.addTarget({
		global1: 1,
		global2: 2,
	});

	let data = p.getData();

	t.is(data.global1, 1);
	t.is(data.global2, 2);
	t.is(data.global3, 5);
});