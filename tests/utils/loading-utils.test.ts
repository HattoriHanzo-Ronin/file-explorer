import LoadingUtils from "../../src/utils/loading-utils";

describe("LoadingUtils", () => {
    const setIsLoading = jest.fn();
    const loadingUtils = new LoadingUtils(setIsLoading);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns the operation result and clears loading after completion", async () => {
        await expect(loadingUtils.run(async () => "result")).resolves.toBe("result");
        expect(setIsLoading.mock.calls).toEqual([[true], [false]]);
    });

    it("keeps loading active until concurrent operations finish", async () => {
        let completeFirst!: () => void;
        let completeSecond!: () => void;
        const first = loadingUtils.run(() => new Promise<void>((resolve) => (completeFirst = resolve)));
        const second = loadingUtils.run(() => new Promise<void>((resolve) => (completeSecond = resolve)));
        expect(setIsLoading.mock.calls).toEqual([[true]]);
        completeFirst();
        await first;
        expect(setIsLoading.mock.calls).toEqual([[true]]);
        completeSecond();
        await second;
        expect(setIsLoading.mock.calls).toEqual([[true], [false]]);
    });
});
