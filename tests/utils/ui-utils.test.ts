import UiUtils from "../../src/utils/ui-utils";
import type { FileOperationSnapshot } from "../../src/types/file-operations";

function operation(overrides: Partial<FileOperationSnapshot>): FileOperationSnapshot {
    return {
        id: "operation-1",
        operation: "DOWNLOAD",
        status: "PENDING",
        revision: 1,
        bytesTransferred: 0,
        totalBytes: 0,
        remoteDir: "",
        destinationDir: "",
        localDir: "",
        ...overrides
    };
}

describe("foreground operation messages", () => {
    afterEach(() => jest.restoreAllMocks());

    it("shows one start and one completion for each operation", () => {
        const show = jest.spyOn(UiUtils, "showMessage").mockImplementation();
        const listener = UiUtils.createFileOperationMessageListener();
        listener(operation({}));
        listener(operation({ status: "RUNNING", revision: 2 }));
        listener(operation({ status: "COMPLETED", revision: 3 }));
        listener(operation({ status: "COMPLETED", revision: 3 }));
        listener(operation({ id: "operation-2", operation: "LOCAL_COPY" }));
        listener(operation({ id: "operation-2", operation: "LOCAL_COPY", status: "COMPLETED", revision: 2 }));
        expect(show.mock.calls.map(([message]) => message)).toEqual([
            "Operación en curso",
            "Descarga completada",
            "Operación en curso",
            "Copia completada"
        ]);
        expect(show.mock.calls[0]).toEqual(["Operación en curso", "SHORT"]);
        expect(show.mock.calls[1]).toEqual(["Descarga completada"]);
    });

    it("shows cancellation and silent failures without duplicating API validation errors", () => {
        const show = jest.spyOn(UiUtils, "showMessage").mockImplementation();
        const listener = UiUtils.createFileOperationMessageListener();
        listener(operation({ status: "CANCELLED" }));
        listener(operation({ id: "failed", status: "FAILED" }));
        listener(
            operation({
                id: "validation",
                operation: "REMOTE_RENAME",
                status: "FAILED",
                error: { code: "VALIDATION_FAILED", message: "No válido" }
            })
        );
        expect(show.mock.calls.map(([message]) => message)).toEqual([
            "Operación cancelada",
            "No se pudo completar la operación"
        ]);
    });
});
