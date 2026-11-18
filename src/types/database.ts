/** Database value supported by the native bridge */
export type DatabaseValue = boolean | number | string | null;

/** Database row supported by the native bridge */
export type DatabaseRow = Record<string, DatabaseValue>;

/** Options for querying the local database */
export interface DatabaseQuery {
    columns?: string[];
    where?: DatabaseRow;
    orderBy?: { column: string; descending?: boolean };
    limit?: number;
}

export interface DatabaseInsert {
    type: "insert";
    table: string;
    values: DatabaseRow;
}

export interface DatabaseUpdate {
    type: "update";
    table: string;
    values: DatabaseRow;
    where: DatabaseRow;
}

export interface DatabaseDelete {
    type: "delete";
    table: string;
    where: DatabaseRow;
}

export type DatabaseMutation = DatabaseDelete | DatabaseInsert | DatabaseUpdate;

export type DatabaseInsertParams = Omit<DatabaseInsert, "type">;
export type DatabaseUpdateParams = Omit<DatabaseUpdate, "type">;
export type DatabaseDeleteParams = Omit<DatabaseDelete, "type">;

export interface DatabaseQueryParams {
    table: string;
    options?: DatabaseQuery;
}

export interface DatabaseGetByIdParams {
    table: string;
    id: DatabaseValue;
    column?: string;
}
