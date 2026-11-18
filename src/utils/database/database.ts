import type {
    DatabaseDeleteParams,
    DatabaseGetByIdParams,
    DatabaseInsertParams,
    DatabaseMutation,
    DatabaseQueryParams,
    DatabaseRow,
    DatabaseUpdateParams
} from "../../types/database";

/** Persistent local database contract */
export interface Database {
    /**
     * Inserts a row
     *
     * @param params.table Table name
     * @param params.values Row values
     * @returns Inserted row identifier
     */
    insert(params: DatabaseInsertParams): Promise<number>;

    /**
     * Updates rows
     *
     * @param params.table Table name
     * @param params.values Values to update
     * @param params.where Row condition
     * @returns Updated row count
     */
    update(params: DatabaseUpdateParams): Promise<number>;

    /**
     * Deletes rows
     *
     * @param params.table Table name
     * @param params.where Row condition
     * @returns Deleted row count
     */
    delete(params: DatabaseDeleteParams): Promise<number>;

    /**
     * Returns matching rows
     *
     * @param params.table Table name
     * @param params.options Query options
     * @returns Matching rows
     */
    query<T extends DatabaseRow>(params: DatabaseQueryParams): Promise<T[]>;

    /**
     * Returns a row by identifier
     *
     * @param params.table Table name
     * @param params.id Row identifier
     * @param params.column Identifier column
     * @returns Matching row
     */
    getById<T extends DatabaseRow>(params: DatabaseGetByIdParams): Promise<T | null>;

    /**
     * Executes mutations atomically
     *
     * @param operations Database mutations
     * @returns Transaction completion
     */
    executeTransaction(operations: DatabaseMutation[]): Promise<void>;
}
