import { NativeModules } from "react-native";
import type { ThumbnailGenerator } from "../thumbnail-generator";

interface NativeThumbnailModule {
    configure(idleTimeoutMs: number): void;
    generate(path: string): Promise<string | null>;
}

/**
 * Generates local thumbnails through the native platform
 *
 * @author HattoriHanzo-Ronin
 */
export default class NativeThumbnailGenerator implements ThumbnailGenerator {
    private readonly thumbnailModule: NativeThumbnailModule;

    constructor(options: { idleTimeoutMs: number }) {
        this.thumbnailModule = NativeModules.ThumbnailGenerator as NativeThumbnailModule;
        this.thumbnailModule.configure(options.idleTimeoutMs);
    }

    /**
     * Returns a cached thumbnail for a local image or video
     *
     * @param path Local file path
     * @returns Thumbnail URI or null when the file is unsupported
     */
    async generate(path: string): Promise<string | null> {
        return this.thumbnailModule.generate(path);
    }
}
