import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({ useNavigation: jest.fn() }));
jest.mock("@react-native-vector-icons/ionicons", () => ({ Ionicons: () => null }));
jest.mock("../../src/components/app-context-provider", () => ({ useAppContext: jest.fn() }));
jest.mock("../../src/components/operation-provider", () => ({ useOperationContext: jest.fn() }));
jest.mock("../../src/components/theme-provider", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../../src/utils/navigation-utils", () => ({ cancelFileAction: jest.fn() }));

import { useAppContext } from "../../src/components/app-context-provider";
import { useOperationContext } from "../../src/components/operation-provider";
import { RenameMenu } from "../../src/app/_overflow-menu";

test("allows independent renames while another is pending", async () => {
    const rename = jest.fn(() => new Promise(() => {}));
    const context = {
        ftpDirectory: { dir: " ", content: [] },
        modifyFtpFile: [],
        modifyLocalFile: [{ path: "/storage/first.txt", type: "file" }],
        setDirSelected: jest.fn(),
        setFtpDirectory: jest.fn(),
        setLocalDirectory: jest.fn(),
        setModifyFtpFile: jest.fn(),
        setModifyLocalFile: jest.fn()
    };
    jest.mocked(useAppContext).mockReturnValue(context as never);
    jest.mocked(useOperationContext).mockReturnValue({
        executeApiRequest: jest.fn(),
        executeLocalRequest: (request: (manager: { rename: typeof rename }) => unknown) => request({ rename })
    } as never);
    const onFinish = jest.fn();
    const setVisible = jest.fn();
    const view = await render(<RenameMenu key="first" storage="local" setVisible={setVisible} onFinish={onFinish} />);
    await fireEvent.changeText(screen.getByDisplayValue("first.txt"), "first-new.txt");
    await fireEvent.press(screen.getByText("Aceptar"));
    expect(rename).toHaveBeenCalledWith({ path: "/storage/first.txt", type: "file" }, "first-new.txt");

    context.modifyLocalFile = [{ path: "/storage/second.txt", type: "file" }];
    await view.rerender(
        <>
            <RenameMenu key="first" storage="local" setVisible={setVisible} onFinish={onFinish} />
            <RenameMenu key="second" storage="local" setVisible={setVisible} onFinish={onFinish} />
        </>
    );
    await fireEvent.changeText(screen.getByDisplayValue("second.txt"), "second-new.txt");
    await fireEvent.press(screen.getByText("Aceptar"));
    expect(rename).toHaveBeenCalledWith({ path: "/storage/second.txt", type: "file" }, "second-new.txt");
    expect(rename).toHaveBeenCalledTimes(2);
});
