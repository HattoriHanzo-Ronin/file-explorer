import { NativeEventEmitter, NativeModules } from "react-native";
import type { SharedFile } from "../../../types/sharing";
import type { Sharing } from "../sharing";

interface NativeSharingModule {
    share(paths: string[]): Promise<void>;
    getReceivedFiles(): Promise<SharedFile[]>;
    cleanupReceivedFiles(paths: string[]): Promise<void>;
}

/** Android sharing implementation */
export default class NativeSharing implements Sharing {
    private readonly module = NativeModules.Sharing as NativeSharingModule;
    private readonly eventEmitter = new NativeEventEmitter(NativeModules.Sharing);

    /** Shares local files through Android */
    async share(paths: string[]): Promise<void> {
        await this.module.share(paths);
    }

    /** Returns files received before JavaScript was ready */
    async getReceivedFiles(): Promise<SharedFile[]> {
        return this.module.getReceivedFiles();
    }

    /** Deletes temporary files received from other applications */
    async cleanupReceivedFiles(paths: string[]): Promise<void> {
        await this.module.cleanupReceivedFiles(paths);
    }

    /** Adds a listener for files received while the app is active */
    addReceivedFilesListener(listener: (files: SharedFile[]) => void): () => void {
        const subscription = this.eventEmitter.addListener("SharedFilesReceived", (files) =>
            listener(files as SharedFile[])
        );
        return () => subscription.remove();
    }
}
