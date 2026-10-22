import type { DatabaseMutation, DatabaseQuery, DatabaseRow, DatabaseValue } from "../../types/database";

/** Persistent local database contract */
export interface Database {
    /**
     * Inserts a row
     *
     * @param table Table name
     * @param values Row values
     * @returns Inserted row identifier
     */
    insert(table: string, values: DatabaseRow): Promise<number>;

    /**
     * Updates rows
     *
     * @param table Table name
     * @param values Values to update
     * @param where Row condition
     * @returns Updated row count
     */
    update(table: string, values: DatabaseRow, where: DatabaseRow): Promise<number>;

    /**
     * Deletes rows
     *
     * @param table Table name
     * @param where Row condition
     * @returns Deleted row count
     */
    delete(table: string, where: DatabaseRow): Promise<number>;

    /**
     * Returns matching rows
     *
     * @param table Table name
     * @param options Query options
     * @returns Matching rows
     */
    query<T extends DatabaseRow>(table: string, options?: DatabaseQuery): Promise<T[]>;

    /**
     * Returns a row by identifier
     *
     * @param table Table name
     * @param id Row identifier
     * @param column Identifier column
     * @returns Matching row
     */
    getById<T extends DatabaseRow>(table: string, id: DatabaseValue, column?: string): Promise<T | null>;

    /**
     * Executes mutations atomically
     *
     * @param operations Database mutations
     * @returns Transaction completion
     */
    executeTransaction(operations: DatabaseMutation[]): Promise<void>;
}
