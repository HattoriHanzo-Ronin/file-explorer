import mime from "mime";
import { EXTRACTABLE_ARCHIVE_EXTENSIONS } from "../constants/archives";
import type { FileIconType, FileOperationNameParams } from "../types/files";
import type { FileSystemEntry } from "../types/files";
import type { ResponseError, ValidationErrorDetail } from "../types/response";

/**
 * Provides local file presentation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class FileUtils {
    private static readonly MIME_FILE_TYPES: [string, FileIconType][] = [
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
    private static readonly EXECUTABLE_EXTENSIONS = ["exe", "bat", "sh"];
    private static readonly SYSTEM_EXTENSIONS = ["dll", "drv", "dylib", "so", "sys"];
    private static readonly TEXT_EXTENSIONS = ["csv", "log", "md", "rtf", "txt"];
    private static readonly CODE_EXTENSIONS = [
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
    private static readonly NAME_REGEX = /^[^\p{Cc}/\\]+$/u;

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

        return FileUtils.NAME_REGEX.test(name) ? undefined : "El nombre tiene un formato no válido";
    }

    /**
     * Returns a validation error for a file operation name
     *
     * @param params.name Name to validate
     * @param params.field Field associated with the error
     * @param params.currentName Current name when renaming
     * @returns Validation error or nothing
     */
    static validateOperationName(
        params: FileOperationNameParams
    ): (ResponseError & { details: ValidationErrorDetail[] }) | undefined {
        const { name, field, currentName } = params;
        const normalizedName = name.trim();
        const message =
            currentName === normalizedName ? "El nuevo nombre debe ser diferente" : FileUtils.validateName(normalizedName);
        return message ? { code: "VALIDATION_ERROR", message, details: [{ field, message }] } : undefined;
    }

    /**
     * Returns a directory content hash
     *
     * @param entries Directory entries
     * @returns Directory hash
     */
    static hashDirectory(entries: FileSystemEntry[]): string {
        const source = entries
            .map(({ isDirectory, mtime, name, size }) =>
                [name, size, mtime?.getTime() ?? 0, isDirectory() ? "dir" : "file"].join(":")
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
        if (FileUtils.isArchive(file, mimeType)) {
            return "compress";
        }

        const mimeFileType = FileUtils.MIME_FILE_TYPES.find(([type]) => mimeType?.includes(type));
        if (mimeFileType) {
            return mimeFileType[1];
        }

        const extension = file.split(".").pop()?.toLowerCase() ?? "";
        if (extension === "apk") {
            return "apk";
        }

        if (FileUtils.EXECUTABLE_EXTENSIONS.includes(extension)) {
            return "exe";
        }

        if (FileUtils.SYSTEM_EXTENSIONS.includes(extension)) {
            return "system";
        }

        if (FileUtils.TEXT_EXTENSIONS.includes(extension)) {
            return "text";
        }

        return FileUtils.CODE_EXTENSIONS.includes(extension) ? "code" : "file";
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
