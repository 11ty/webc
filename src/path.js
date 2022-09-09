import path from "path";

class Path {
	// cross browser normalize a file path to use /
	static normalizePath(filePath) {
		if(typeof filePath === "string") {
			return filePath.split(path.sep).join("/");
		}
		return filePath;
	}
}

export { Path };