import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("@react-native-vector-icons/ionicons", () => ({ Ionicons: () => null }));
jest.mock("../../src/components/app-context-provider", () => ({ useAppContext: jest.fn() }));
jest.mock("../../src/components/operation-provider", () => ({ useOperationContext: jest.fn() }));
jest.mock("../../src/components/theme-provider", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../../src/components/breadcrumb", () => () => null);
jest.mock("../../src/components/create-directory-dialog", () => () => null);

import { useAppContext } from "../../src/components/app-context-provider";
import { useOperationContext } from "../../src/components/operation-provider";
import OperationDestinationModal from "../../src/components/operation-destination-modal";

test("copies FTP entries to the selected remote destination", async () => {
    const copyEntries = jest.fn().mockResolvedValue({
        success: true,
        data: {
            destination: { dir: " ", version: "2" },
            changes: [{ path: "file.txt", targetPath: "file.txt", type: "FILE", completed: 1, total: 1 }]
        }
    });
    const getDirectory = jest.fn().mockResolvedValue({ success: true, data: { entries: [], version: "1" } });
    const setFtpDirectory = jest.fn();
    jest.mocked(useAppContext).mockReturnValue({
        externalRoots: [],
        ftpSelectionDir: "source",
        internalRoot: { id: "internal", name: "Interno", path: "/storage", type: "INTERNAL" },
        modifyFtpFile: [{ path: "file.txt", type: "FILE" }],
        modifyLocalFile: [],
        setFtpDirectory,
        setLocalDirectory: jest.fn(),
        setModifyFtpFile: jest.fn(),
        setModifyLocalFile: jest.fn()
    } as never);
    jest.mocked(useOperationContext).mockReturnValue({
        executeApiRequest: (request: (api: { copyEntries: typeof copyEntries; getDirectory: typeof getDirectory }) => unknown) =>
            request({ copyEntries, getDirectory }),
        executeLocalRequest: jest.fn()
    } as never);

    await render(<OperationDestinationModal action="copy" visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByText("Copiar aquí"));

    expect(copyEntries).toHaveBeenCalledWith({
        dir: "source", destination: " ", entries: [{ name: "file.txt", type: "FILE" }]
    });
    const update = setFtpDirectory.mock.lastCall?.[0] as (current: object) => object;
    expect(update({ dir: " ", content: [], version: "1" })).toEqual({
        dir: " ", content: [{ name: "file.txt", type: "FILE" }], version: "2"
    });
});
