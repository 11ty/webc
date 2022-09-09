import path from "path";

class Path {
	// cross browser normalize a file path to use /
	static normalizePath(filePath) {
		return filePath.split(path.sep).join("/");
	}
}

export { Path };