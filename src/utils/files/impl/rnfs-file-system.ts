import { NativeEventEmitter, NativeModules } from "react-native";
import RNFS from "react-native-fs";
import type { StorageRoot, StorageRootNames } from "../../../types/files";
import type { FileSystem, FileSystemEntry, FileSystemStat } from "../file-system";

interface NativeStorageVolumeModule {
    getExternalRoots(externalStorageName: string): Promise<StorageRoot[]>;
}

/**
 * Provides file system operations through React Native FS
 */
export default class RNFSFileSystem implements FileSystem {
    readonly internalRoot: StorageRoot;
    private readonly storageRootNames: StorageRootNames;
    private readonly storageVolume = NativeModules.StorageVolume as NativeStorageVolumeModule;
    private readonly eventEmitter = new NativeEventEmitter(NativeModules.StorageVolume);

    constructor(storageRootNames: StorageRootNames) {
        this.storageRootNames = storageRootNames;
        this.internalRoot = {
            id: "internal",
            name: storageRootNames.internal,
            path: RNFS.ExternalStorageDirectoryPath,
            type: "INTERNAL"
        };
    }

    /**
     * Returns mounted removable storage roots
     *
     * @returns Removable storage roots
     */
    async getExternalRoots(): Promise<StorageRoot[]> {
        return this.storageVolume.getExternalRoots(this.storageRootNames.external);
    }

    /**
     * Adds a removable storage change listener
     *
     * @param listener Storage roots listener
     * @returns Listener cleanup
     */
    addStorageRootsChangeListener(listener: (roots: StorageRoot[]) => void): () => void {
        const subscription = this.eventEmitter.addListener("StorageVolumesChanged", (roots) =>
            listener(roots as unknown as StorageRoot[])
        );
        return () => subscription.remove();
    }

    /**
     * Returns whether a path exists
     *
     * @param path File system path
     * @returns Whether the path exists
     */
    async exists(path: string): Promise<boolean> {
        return RNFS.exists(path);
    }

    /**
     * Returns the entries in a directory
     *
     * @param path Directory path
     * @returns Directory entries
     */
    async readDir(path: string): Promise<FileSystemEntry[]> {
        return RNFS.readDir(path);
    }

    /**
     * Returns file system metadata
     *
     * @param path File system path
     * @returns File system metadata
     */
    async stat(path: string): Promise<FileSystemStat> {
        return RNFS.stat(path);
    }

    /**
     * Creates a directory
     *
     * @param path Directory path
     */
    async mkdir(path: string): Promise<void> {
        await RNFS.mkdir(path);
    }

    /**
     * Creates a file copy
     *
     * @param origin Source file path
     * @param destination Destination file path
     */
    async copyFile(origin: string, destination: string): Promise<void> {
        await RNFS.copyFile(origin, destination);
    }

    /**
     * Moves a file
     *
     * @param origin Source file path
     * @param destination Destination file path
     */
    async moveFile(origin: string, destination: string): Promise<void> {
        await RNFS.moveFile(origin, destination);
    }

    /**
     * Deletes a file or directory
     *
     * @param path File system path
     */
    async remove(path: string): Promise<void> {
        await RNFS.unlink(path);
    }
}
