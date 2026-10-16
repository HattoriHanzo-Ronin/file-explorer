import FileUtils from "../../src/utils/file-utils";

describe("FileUtils", () => {
    it("validates local resource names", () => {
        expect(FileUtils.validateName(" report.txt ")).toBeUndefined();
        expect(FileUtils.validateName(" ")).toBe("El nombre no puede estar vacío");
        expect(FileUtils.validateName("folder/name")).toBe("El nombre tiene un formato no válido");
    });

    it("generates the same hash regardless of directory entry order", () => {
        const file = {
            name: "report.txt",
            path: "/root/report.txt",
            size: 42,
            mtime: new Date(10),
            isDirectory: () => false
        };
        const directory = { name: "docs", path: "/root/docs", size: 0, mtime: new Date(20), isDirectory: () => true };
        expect(FileUtils.hashDirectory([file, directory])).toBe(FileUtils.hashDirectory([directory, file]));
    });

    it("classifies archives, system files, text files and source code", () => {
        expect(FileUtils.getTypeFile("backup.rar")).toBe("compress");
        expect(FileUtils.getTypeFile("driver.sys")).toBe("system");
        expect(FileUtils.getTypeFile("notes.txt")).toBe("text");
        expect(FileUtils.getTypeFile("app.ts")).toBe("code");
    });
});
