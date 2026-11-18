import { NativeModules } from "react-native";
import type {
    DatabaseDeleteParams,
    DatabaseGetByIdParams,
    DatabaseInsertParams,
    DatabaseMutation,
    DatabaseQuery,
    DatabaseQueryParams,
    DatabaseRow,
    DatabaseUpdateParams,
    DatabaseValue
} from "../../../types/database";
import type { Database } from "../database";

interface NativeDatabaseModule {
    insert(table: string, values: DatabaseRow): Promise<number>;
    update(table: string, values: DatabaseRow, where: DatabaseRow): Promise<number>;
    delete(table: string, where: DatabaseRow): Promise<number>;
    query(table: string, options: DatabaseQuery | null): Promise<DatabaseRow[]>;
    getById(table: string, id: { value: DatabaseValue }, column: string): Promise<DatabaseRow | null>;
    executeTransaction(operations: DatabaseMutation[]): Promise<void>;
}

/**
 * Native database implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default class NativeDatabase implements Database {
    private readonly module: NativeDatabaseModule;

    constructor() {
        this.module = NativeModules.Database as NativeDatabaseModule;
    }

    /**
     * Inserts a row
     *
     * @param params.table Table name
     * @param params.values Row values
     * @returns Inserted row identifier
     */
    async insert(params: DatabaseInsertParams) {
        return this.module.insert(params.table, params.values);
    }

    /**
     * Updates rows
     *
     * @param params.table Table name
     * @param params.values Values to update
     * @param params.where Row condition
     * @returns Updated row count
     */
    async update(params: DatabaseUpdateParams) {
        return this.module.update(params.table, params.values, params.where);
    }

    /**
     * Deletes rows
     *
     * @param params.table Table name
     * @param params.where Row condition
     * @returns Deleted row count
     */
    async delete(params: DatabaseDeleteParams) {
        return this.module.delete(params.table, params.where);
    }

    /**
     * Returns matching rows
     *
     * @param params.table Table name
     * @param params.options Query options
     * @returns Matching rows
     */
    async query<T extends DatabaseRow>(params: DatabaseQueryParams) {
        return (await this.module.query(params.table, params.options ?? null)) as T[];
    }

    /**
     * Returns a row by identifier
     *
     * @param params.table Table name
     * @param params.id Row identifier
     * @param params.column Identifier column
     * @returns Matching row
     */
    async getById<T extends DatabaseRow>(params: DatabaseGetByIdParams) {
        return (await this.module.getById(params.table, { value: params.id }, params.column ?? "id")) as T | null;
    }

    /**
     * Executes mutations atomically
     *
     * @param operations Database mutations
     * @returns Transaction completion
     */
    async executeTransaction(operations: DatabaseMutation[]) {
        return this.module.executeTransaction(operations);
    }
}
