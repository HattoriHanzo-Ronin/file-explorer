/** Database value supported by the native bridge */
export type DatabaseValue = boolean | number | string | null;

/** Database row supported by the native bridge */
export type DatabaseRow = Record<string, DatabaseValue>;

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
