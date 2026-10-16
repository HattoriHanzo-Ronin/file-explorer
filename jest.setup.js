/* global jest */
jest.mock("mime", () => ({
    __esModule: true,
    default: {
        getType(file) {
            const extension = file.split(".").pop()?.toLowerCase();
            return (
                {
                    jpg: "image/jpeg",
                    jpeg: "image/jpeg",
                    mp4: "video/mp4",
                    pdf: "application/pdf",
                    zip: "application/zip",
                    txt: "text/plain",
                    ts: "text/typescript"
                }[extension] ?? null
            );
        }
    }
}));
