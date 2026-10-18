import { NativeModules } from "react-native";
import type { ThumbnailGenerator } from "../thumbnail-generator";

interface NativeThumbnailModule {
    configure(maxBytes: number, idleTimeoutMs: number): void;
    generate(path: string): Promise<string | null>;
}

/**
 * Generates local thumbnails through the native platform
 *
 * @author HattoriHanzo-Ronin
 */
export default class NativeThumbnailGenerator implements ThumbnailGenerator {
    private readonly thumbnailModule = NativeModules.ThumbnailGenerator as NativeThumbnailModule;

    constructor(options: { maxBytes: number; idleTimeoutMs: number }) {
        const { maxBytes, idleTimeoutMs } = options;
        this.thumbnailModule.configure(maxBytes, idleTimeoutMs);
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
