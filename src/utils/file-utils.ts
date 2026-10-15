import mime from "mime";
import { EXTRACTABLE_ARCHIVE_EXTENSIONS } from "../constants/archives";
import type { FileIconType } from "../types/files";
import type { FileSystemEntry } from "./files/file-system";

const MIME_FILE_TYPES: [string, FileIconType][] = [
    ["image", "image"],
    ["video", "video"],
    ["audio", "audio"],
    ["pdf", "pdf"],
    ["word", "word"],
    ["excel", "excel"],
    ["spreadsheet", "excel"],
    ["presentation", "power"],
    ["powerpoint", "power"]
];
const EXECUTABLE_EXTENSIONS = ["exe", "bat", "sh"];
const CODE_EXTENSIONS = [
    "js",
    "ts",
    "jsx",
    "tsx",
    "java",
    "kt",
    "kts",
    "cs",
    "py",
    "c",
    "cpp",
    "h",
    "hpp",
    "php",
    "rb",
    "go",
    "rs",
    "swift",
    "html",
    "css",
    "scss",
    "json",
    "xml"
];
const NAME_REGEX = /^[^\p{Cc}/\\]+$/u;

/**
 * Provides local file presentation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class FileUtils {
    /**
     * Returns a validation message for a local resource name
     *
     * @param name Resource name
     * @returns Validation message or nothing
     */
    static validateName(name: string): string | undefined {
        if (name.trim().length === 0) {
            return "El nombre no puede estar vacío";
        }

        return NAME_REGEX.test(name) ? undefined : "El nombre tiene un formato no válido";
    }

    /**
     * Returns a directory content hash
     *
     * @param entries Directory entries
     * @returns Directory hash
     */
    static hashDirectory(entries: FileSystemEntry[]): string {
        const source = entries
            .map((entry) =>
                [entry.name, entry.size, entry.mtime?.getTime() ?? 0, entry.isDirectory() ? "dir" : "file"].join(":")
            )
            .sort()
            .join("|");
        let hash = 5381;
        for (let index = 0; index < source.length; index += 1) {
            hash = (hash * 33 + source.charCodeAt(index)) % 4294967296;
        }

        return hash.toString(16).padStart(8, "0");
    }

    /**
     * Returns the visual type for a file
     *
     * @param file File name
     * @returns Visual file type
     */
    static getTypeFile(file: string): FileIconType {
        const mimeType = mime.getType(file);
        if (this.isArchive(file, mimeType)) {
            return "compress";
        }

        const mimeFileType = MIME_FILE_TYPES.find(([type]) => mimeType?.includes(type));
        if (mimeFileType) {
            return mimeFileType[1];
        }

        const extension = file.split(".").pop()?.toLowerCase() ?? "";
        if (extension === "apk") {
            return "apk";
        }

        if (EXECUTABLE_EXTENSIONS.includes(extension)) {
            return "exe";
        }

        return CODE_EXTENSIONS.includes(extension) ? "code" : "file";
    }

    private static isArchive(file: string, mimeType: string | null): boolean {
        const extension = file.split(".").pop()?.toLowerCase() ?? "";
        return (
            mimeType?.includes("zip") === true ||
            mimeType?.includes("compressed") === true ||
            extension === "rar" ||
            EXTRACTABLE_ARCHIVE_EXTENSIONS.includes(extension)
        );
    }
}
