const mockSharing = {
    addListener: jest.fn(),
    cleanupReceivedFiles: jest.fn(),
    getReceivedFiles: jest.fn(),
    removeListeners: jest.fn(),
    share: jest.fn()
};

import { NativeModules } from "react-native";
import NativeSharing from "../../../../src/utils/sharing/impl/native-sharing";

describe("NativeSharing", () => {
    let sharing: NativeSharing;

    beforeEach(() => {
        jest.clearAllMocks();
        (NativeModules as { Sharing: typeof mockSharing }).Sharing = mockSharing;
        sharing = new NativeSharing();
    });

    it("delegates sharing files to the native module", async () => {
        mockSharing.share.mockResolvedValue(undefined);
        await expect(sharing.share(["/storage/report.pdf"])).resolves.toBeUndefined();
        expect(mockSharing.share).toHaveBeenCalledWith(["/storage/report.pdf"]);
    });

    it("returns files received before JavaScript was ready", async () => {
        const files = [
            {
                id: "report",
                name: "report.pdf",
                path: "/data/user/0/app/files/shared/report.pdf",
                status: "READY" as const
            }
        ];
        mockSharing.getReceivedFiles.mockResolvedValue(files);
        await expect(sharing.getReceivedFiles()).resolves.toEqual(files);
    });

    it("delegates received file cleanup to the native module", async () => {
        const paths = ["/data/user/0/app/files/shared/a/report.pdf"];
        mockSharing.cleanupReceivedFiles.mockResolvedValue(undefined);
        await expect(sharing.cleanupReceivedFiles(paths)).resolves.toBeUndefined();
        expect(mockSharing.cleanupReceivedFiles).toHaveBeenCalledWith(paths);
    });
});
