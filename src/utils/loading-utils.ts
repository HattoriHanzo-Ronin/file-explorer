/**
 * Loading state manager
 *
 * @author HattoriHanzo-Ronin
 */
export default class LoadingUtils {
    private activeOperations = 0;
    private setIsLoading: (isLoading: boolean) => void;

    constructor(setIsLoading: (isLoading: boolean) => void) {
        this.setIsLoading = setIsLoading;
    }

    /**
     * Runs an asynchronous operation while managing the loading state
     *
     * @param callback Asynchronous operation
     * @returns Operation result
     */
    async run<T>(callback: () => Promise<T>): Promise<T> {
        try {
            this.activeOperations++;
            if (this.activeOperations === 1) {
                this.setIsLoading(true);
            }

            return await callback();
        } finally {
            this.activeOperations--;
            if (this.activeOperations === 0) {
                this.setIsLoading(false);
            }
        }
    }
}
