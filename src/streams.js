import Stream from "stream";

class Streams {
	constructor(buckets = []) {
		this.streams = {};
		this.buckets = buckets;
		this.started = false;
	}

	setBuckets(buckets) {
		if(this.started) {
			throw new Error("You can’t setBuckets after streaming has already started.");
		}

		this.buckets = buckets;
	}

	get() {
		return this.streams;
	}

	output(name, str) {
		if(this.started && this.streams[name]) {
			// console.log( "Streaming to", name, { str } );
			this.streams[name].push(str);
		}
	}

	start() {
		if(this.started) {
			// don’t start twice
			return;
		}

		this.started = true;

		for(let name of this.buckets) {
			this.streams[name] = new Stream.Readable({
				read() {},
				encoding: "utf8",
			});
		}
	}

	error(name, error) {
		if(this.streams[name]) {
			this.streams[name].destroy(error);
		}
	}

	end() {
		for(let name in this.streams) {
			// push(null) is required by Node to trigger the close event on the stream
			this.streams[name].push(null);
		}
	}
}

export { Streams };