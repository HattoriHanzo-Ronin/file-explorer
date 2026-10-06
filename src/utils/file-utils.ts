import { Alert } from "react-native";
import type { AppContextType } from "../types/context";
import type { ModifyElement } from "../types/files";
import RNFS from "react-native-fs";
import { unzip, zip } from "react-native-zip-archive";
import axios from "axios";
import { NativeModules } from "react-native";
import mime from "mime";
import UiUtils from "./ui-utils";

const { FileOpener } = NativeModules;
const ROOT = RNFS.ExternalStorageDirectoryPath;
const CACHEDIR = RNFS.CachesDirectoryPath;

export const makePathWithRoot = (path: string) => (path === " " ? ROOT : `${ROOT}/${path}`);
/**
 * Returns an available name for an item in the destination
 *
 * @param destination Destination directory
 * @param name Requested item name
 * @returns Available item name
 */
export const getFileName = async (destination: string, name: string): Promise<string> => {
    const exist = await RNFS.exists(`${destination}/${name}`);
    if (exist && !name.split(`_`).shift()?.includes("copia")) {
        return await getFileName(destination, `copia_${name}`);
    }

    if (exist) {
        const newName = name.slice(name.indexOf("_") + 1, name.length);
        const lastCopy = name.split("_").shift()?.replace("copia", "");
        return await getFileName(destination, `copia${Number(lastCopy) + 1 || "1"}_${newName}`);
    }

    return name;
};
/**
 * Uploads local files and directories as an archive
 *
 * @param toUpload Local items to upload
 * @param destination Remote destination directory
 * @param context Application context
 */
export const upload = async (toUpload: ModifyElement[], destination: string, context: AppContextType) => {
    const tempDir = `${CACHEDIR}/temp${Date.now()}`;
    const tempToZip = `${tempDir}/toZip`;
    const zipFile = `${tempDir}/${Date.now()}.zip`;
    const formData = new FormData();
    let toZip;
    try {
        context.setIsLoading(true);
        await RNFS.mkdir(tempToZip);
        await cpmv(toUpload, tempToZip, true);
        toZip = await zip(tempToZip, zipFile);
        formData.append("file", { uri: `file://${toZip}`, name: zipFile.split("/")[1], type: "application/zip" });
        await fetch(
            destination === " " ? `${context.url}/upload` : `${context.url}/upload?dir=${encodeURI(destination)}`,
            { method: "POST", body: formData }
        );
    } catch {
        UiUtils.showMessage("Error al subir el archivo");
    } finally {
        context.setIsLoading(false);
        await RNFS.unlink(tempDir);
    }
};
/**
 * Downloads remote files and directories to local storage
 *
 * @param toDownload Remote items to download
 * @param destination Local destination directory
 * @param context Application context
 */
export const download = async (toDownload: ModifyElement[], destination: string, context: AppContextType) => {
    const last = context.lastFtpDir;
    const url = `${context.url}/download`;
    const dest = makePathWithRoot(destination);
    try {
        context.setIsLoading(true);

        if (toDownload.length === 1 && toDownload[0].type === "file") {
            const file = toDownload[0].path;
            const params = new URLSearchParams(last === " " ? { file } : { dir: last, file });
            await RNFS.downloadFile({
                fromUrl: `${url}?${params.toString()}`,
                toFile: `${dest}/${await getFileName(dest, file)}`
            }).promise;
        } else {
            const { data } = await axios.post(last === " " ? url : `${url}?dir=${encodeURI(last)}`, {
                data: toDownload
            });
            await RNFS.downloadFile({ fromUrl: `${url}/${data.id}`, toFile: `${dest}/${Date.now()}.zip` }).promise;
        }
    } catch {
        UiUtils.showMessage("Error al descargar el archivo");
    } finally {
        context.setIsLoading(false);
    }
};
/**
 * Copies or moves a directory recursively
 *
 * @param origin Source directory
 * @param destination Destination directory
 * @param cp Whether to keep the source directory
 * @param name Optional destination name
 */
export const copyDir = async (origin: string, destination: string, cp?: boolean, name?: string) => {
    const dirToSplit = origin.split("/");
    let nameDir = "";
    let newDir;
    let dir;
    nameDir = await getFileName(destination, name ?? dirToSplit[dirToSplit.length - 1]);
    dir = await RNFS.readDir(origin);
    newDir = `${destination}/${nameDir}`;
    await RNFS.mkdir(newDir);

    for (const item of dir) {
        if (item.isDirectory()) {
            await copyDir(item.path, newDir, cp);
        } else {
            const name = item.path.split("/").pop();
            await RNFS.copyFile(item.path, `${newDir}/${name}`);
        }
    }

    if (!cp) {
        await RNFS.unlink(origin);
    }
};
/**
 * Copies, moves, or renames local items
 *
 * @param toCopy Items to process
 * @param destination Destination directory
 * @param cp Whether to keep the source items
 * @param name Optional destination name
 */
export const cpmv = async (toCopy: ModifyElement[], destination: string, cp?: boolean, name?: string) => {
    for (const item of toCopy) {
        console.log(item.path);
        const currentItem = makePathWithRoot(item.path);

        if (item.type === "dir") {
            await copyDir(currentItem, destination, cp, name);
        } else {
            const currentItemToSplit = currentItem.split("/");
            const fileName = await getFileName(destination, name ?? currentItemToSplit[currentItemToSplit.length - 1]);
            const dest = `${destination}/${fileName}`;
            if (cp) {
                await RNFS.copyFile(currentItem, dest);
            } else {
                await RNFS.moveFile(currentItem, dest);
            }
        }
    }
};
/**
 * Coordinates the copy or move menu workflow
 *
 * @param context Application context
 * @param setVisible Updates menu visibility
 * @param title Current menu item title
 * @param setTitle Updates the menu item title
 * @param cp Whether to copy instead of move
 */
export const cpmvPath = async (
    context: AppContextType,
    setVisible: (visible: boolean) => void,
    title: string,
    setTitle: (title: string) => void,
    cp?: boolean
) => {
    const toCopy = context.modifyLocalFile;
    const titleToShow = title.toLocaleLowerCase();

    if (toCopy.length < 1) {
        return UiUtils.noElements(setVisible);
    }

    if (title === "Copiar" || title === "Mover") {
        if (context.onCopy) {
            return UiUtils.showMessage("Acción no disponible");
        }

        UiUtils.showMessage(`Elija el directorio donde ${titleToShow}`);
        setTitle("Pegar");
        setVisible(false);
        context.setOnCopy(true);
        context.setDirSelected(!context.dirSelected);
    } else {
        try {
            context.setIsLoading(true);
            const lastDir = makePathWithRoot(context.lastLocalDir);
            await cpmv(toCopy, lastDir, cp);
            context.setRefresh(!context.refresh);
        } catch {
            UiUtils.showMessage(`Error al ${title}`);
        } finally {
            context.setIsLoading(false);
            context.setModifyLocalFile([]);
            setTitle(cp ? "Copiar" : "Mover");
            setVisible(false);
            context.setOnCopy(false);
        }
    }
};
export const makeDir = async (context: AppContextType, name: string, setVisible: (visible: boolean) => void) => {
    try {
        let last;

        if (context.lastComponent === "local") {
            last = makePathWithRoot(context.lastLocalDir);
            await RNFS.mkdir(`${last}/${await getFileName(last, name)}`);
        } else {
            last = context.lastFtpDir;
            await axios.post(`${context.url}/mkdir${last === " " ? "" : `?dir=${encodeURI(last)}`}`, {
                name
            });
        }
    } catch {
        UiUtils.showMessage("Error al crear carpeta");
    } finally {
        setVisible(false);
        context.setRefresh(!context.refresh);
    }
};
export const rename = async (
    toRename: ModifyElement[],
    name: string,
    destination: string,
    context: AppContextType,
    setVisible: (visible: boolean) => void
) => {
    try {
        await cpmv(toRename, destination, false, name);
    } catch {
        UiUtils.showMessage("Error al renombrar");
    } finally {
        setVisible(false);
        context.setModifyLocalFile([]);
        context.setRefresh(!context.refresh);
    }
};
/**
 * Deletes local or remote items
 *
 * @param toRemove Items to delete
 * @param origin Storage containing the items
 * @param context Application context
 * @param setVisible Updates menu visibility
 */
export const remove = async (
    toRemove: ModifyElement[],
    origin: string,
    context: AppContextType,
    setVisible: (visible: boolean) => void
) => {
    try {
        context.setIsLoading(true);

        for (const item of toRemove) {
            if (origin === "local") {
                await RNFS.unlink(makePathWithRoot(item.path));
            } else {
                await axios.delete(
                    `${context.url}/${item.type === "dir" ? "dir" : "file"}?path=${encodeURI(
                        context.lastFtpDir === " " ? item.path : `${context.lastFtpDir}/${item.path}`
                    )}`
                );
            }

            setVisible(false);
        }
    } catch {
        UiUtils.showMessage("Error al borrar");
    } finally {
        context.setIsLoading(false);
        context.setRefresh(!context.refresh);

        if (origin === "local") {
            context.setModifyLocalFile([]);
        }

        if (origin === "ftp") {
            context.setModifyFtpFile([]);
        }
    }
};
export const icons: any = {
    dir: require("../../assets/images/folder.png"),
    file: require("../../assets/images/file.png"),
    image: require("../../assets/images/image.png"),
    video: require("../../assets/images/video.png"),
    audio: require("../../assets/images/audio.png"),
    compress: require("../../assets/images/compress.png"),
    pdf: require("../../assets/images/pdf.png"),
    word: require("../../assets/images/word.png"),
    excel: require("../../assets/images/excel.png"),
    power: require("../../assets/images/power.png"),
    apk: require("../../assets/images/apk.png"),
    exe: require("../../assets/images/exe.png"),
    code: require("../../assets/images/code.png")
};
export const extensionLibrary = (type: string) => {
    if (type === "executable") {
        return ["exe", "bat", "sh"];
    }

    if (type === "code") {
        return [
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
            "xml",
            "sh",
            "bat"
        ];
    }

    return [];
};
export const getTypeFile = (file: string) => {
    const type = mime.getType(file);

    switch (true) {
        case type?.startsWith("image"):
            return "image";

        case type?.startsWith("video"):
            return "video";

        case type?.startsWith("audio"):
            return "audio";

        case type?.includes("zip") || type?.includes("compressed"):
            return "compress";

        case type?.includes("pdf"):
            return "pdf";

        case type?.includes("word"):
            return "word";

        case type?.includes("excel") || type?.includes("spreadsheet"):
            return "excel";

        case type?.includes("presentation") || type?.includes("powerpoint"):
            return "power";

        default: {
            const ext = file.split(".").pop()?.toLowerCase() ?? "";
            if (ext === "apk") {
                return "apk";
            }

            if (extensionLibrary("executable").includes(ext)) {
                return "exe";
            }

            if (extensionLibrary("code").includes(ext)) {
                return "code";
            }

            return "file";
        }
    }
};
/**
 * Opens a file or extracts an archive
 *
 * @param origin Source directory
 * @param name File name
 * @param context Application context
 */
export const openFile = async (origin: string, name: string, context: AppContextType) => {
    const typeFile = getTypeFile(name);
    const originWithRoot = makePathWithRoot(origin);
    const file = `${originWithRoot}/${name}`;
    if (typeFile === "compress") {
        Alert.alert("", "Se va a descomprimir el archivo", [
            {
                text: "Cancel",
                style: "cancel"
            },
            {
                text: "Ok",
                onPress: async () => {
                    const nameZipDir = name.substring(0, name.lastIndexOf("."));
                    const zipDir = `${originWithRoot}/${nameZipDir}`;
                    try {
                        context.setIsLoading(true);
                        await unzip(file, zipDir);
                        const list = await RNFS.readDir(zipDir);
                        await cpmv(
                            list.map((item) => ({
                                path: `${origin}/${nameZipDir}/${item.name}`,
                                type: item.isDirectory() ? "dir" : "file"
                            })),
                            originWithRoot
                        );
                    } catch {
                        UiUtils.showMessage("Error al descomprimir");
                    } finally {
                        await RNFS.unlink(zipDir);
                        await RNFS.unlink(file);
                        context.setIsLoading(false);
                        context.setRefresh(!context.refresh);
                    }
                }
            }
        ]);
    } else {
        try {
            await FileOpener.openFile(file);
        } catch {
            UiUtils.showMessage(`Error al abrir el archivo ${name}`);
        } finally {
            context.setLastLocalDir(" ");
            context.setRefresh(!context.refresh);
        }
    }
};
