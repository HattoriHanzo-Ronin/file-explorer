import React from "react";
import { render } from "@testing-library/react-native";
import type { DestinationOperationModalProps } from "../../src/types/components";
import type { SharedFile } from "../../src/types/sharing";

jest.mock("../../src/components/app-context-provider", () => ({ useAppContext: jest.fn() }));
jest.mock("../../src/components/operation-provider", () => ({ useOperationContext: jest.fn() }));
jest.mock("../../src/components/operation-destination-modal", () => jest.fn(() => null));

import { useAppContext } from "../../src/components/app-context-provider";
import { useOperationContext } from "../../src/components/operation-provider";
import OperationDestinationModal from "../../src/components/operation-destination-modal";
import SharedFilesReceiver from "../../src/components/shared-files-receiver";

test("cleans up only the files belonging to the cancelled share", async () => {
    const first: SharedFile = { id: "first", name: "first.txt", path: "/shared/first/first.txt", status: "READY" };
    const second: SharedFile = { id: "second", name: "second.txt", path: "/shared/second/second.txt", status: "READY" };
    const cleanupReceivedFiles = jest.fn().mockResolvedValue(undefined);
    const context = {
        isAuthenticated: true,
        sharedLoginRequested: { current: false },
        modifyLocalFile: [{ path: first.path, type: "file" }],
        setModifyLocalFile: jest.fn(),
        setSharedFiles: jest.fn(),
        sharedFiles: [first]
    };
    jest.mocked(useAppContext).mockReturnValue(context as never);
    jest.mocked(useOperationContext).mockReturnValue({
        authUtils: {},
        sharing: { addReceivedFilesListener: () => jest.fn(), getReceivedFiles: async () => [], cleanupReceivedFiles }
    } as never);
    const view = await render(<SharedFilesReceiver onRequireLogin={jest.fn()} />);
    const firstProps = jest.mocked(OperationDestinationModal).mock.lastCall?.[0] as DestinationOperationModalProps;
    context.sharedFiles = [second];
    await view.rerender(<SharedFilesReceiver onRequireLogin={jest.fn()} />);
    firstProps.onCancel?.();
    expect(cleanupReceivedFiles).toHaveBeenCalledWith([first.path]);
});

test("updates the selection when shared files finish preparing", async () => {
    const preparing: SharedFile = { id: "file", name: "file.txt", path: null, status: "PREPARING" };
    const ready: SharedFile = { ...preparing, path: "/shared/share/file/file.txt", status: "READY" };
    const setModifyLocalFile = jest.fn();
    const context = {
        isAuthenticated: true,
        sharedLoginRequested: { current: false },
        modifyLocalFile: [],
        setModifyLocalFile,
        setSharedFiles: jest.fn(),
        sharedFiles: [preparing]
    };
    jest.mocked(useAppContext).mockReturnValue(context as never);
    jest.mocked(useOperationContext).mockReturnValue({
        authUtils: {},
        sharing: { addReceivedFilesListener: () => jest.fn(), getReceivedFiles: async () => [] }
    } as never);

    const view = await render(<SharedFilesReceiver onRequireLogin={jest.fn()} />);
    context.sharedFiles = [ready];
    await view.rerender(<SharedFilesReceiver onRequireLogin={jest.fn()} />);

    expect(setModifyLocalFile).toHaveBeenLastCalledWith([{ path: ready.path, type: "file" }]);
});

test("removes all files reported as failed from the pending selection", async () => {
    const first: SharedFile = { id: "first", name: "first.txt", path: null, status: "PREPARING" };
    const second: SharedFile = { id: "second", name: "second.txt", path: null, status: "PREPARING" };
    const setSharedFiles = jest.fn();
    const addReceivedFilesListener = jest.fn((_listener: (files: SharedFile[]) => void) => jest.fn());
    jest.mocked(useAppContext).mockReturnValue({
        isAuthenticated: true,
        sharedLoginRequested: { current: false },
        modifyLocalFile: [],
        setModifyLocalFile: jest.fn(),
        setSharedFiles,
        sharedFiles: [first, second]
    } as never);
    jest.mocked(useOperationContext).mockReturnValue({
        authUtils: {},
        sharing: { addReceivedFilesListener, getReceivedFiles: async () => [] }
    } as never);

    await render(<SharedFilesReceiver onRequireLogin={jest.fn()} />);
    const receive = addReceivedFilesListener.mock.calls[0][0];
    receive([
        { ...first, status: "ERROR" },
        { ...second, status: "ERROR" }
    ]);
    const update = setSharedFiles.mock.lastCall?.[0] as (files: SharedFile[]) => SharedFile[];
    expect(update([first, second])).toEqual([]);
});


test("requests login only once while received files are preparing", async () => {
    const preparing: SharedFile = { id: "file", name: "file.txt", path: null, status: "PREPARING" };
    const context = {
        isAuthenticated: false,
        sharedLoginRequested: { current: false },
        modifyLocalFile: [],
        setModifyLocalFile: jest.fn(),
        setSharedFiles: jest.fn(),
        sharedFiles: [preparing]
    };
    const restoreSession = jest.fn().mockResolvedValue(false);
    const requireLogin = jest.fn();
    jest.mocked(useAppContext).mockReturnValue(context as never);
    jest.mocked(useOperationContext).mockReturnValue({
        authUtils: { restoreSession },
        sharing: { addReceivedFilesListener: () => jest.fn(), getReceivedFiles: async () => [] }
    } as never);

    const first = await render(<SharedFilesReceiver onRequireLogin={requireLogin} />);
    context.sharedFiles = [{ ...preparing, path: "/shared/share/file/file.txt", status: "READY" }];
    await first.rerender(<SharedFilesReceiver onRequireLogin={requireLogin} />);
    await render(<SharedFilesReceiver onRequireLogin={requireLogin} />);

    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(requireLogin).toHaveBeenCalledTimes(1);
});
