package com.hhrcore.fileexplorer.database

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class ExplorerDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {
    override fun onConfigure(database: SQLiteDatabase) {
        database.setForeignKeyConstraintsEnabled(true)
    }

    override fun onCreate(database: SQLiteDatabase) {
        createThumbnailTables(database)
    }

    override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        var version = oldVersion
        while (version < newVersion) {
            version = migrate(database, version)
        }
    }

    private fun migrate(database: SQLiteDatabase, version: Int): Int {
        return when (version) {
            1 -> {
                createThumbnailTables(database)
                3
            }
            2 -> {
                database.execSQL("ALTER TABLE thumbnails ADD COLUMN parent_id TEXT REFERENCES thumbnails(id)")
                database.execSQL("CREATE INDEX idx_thumbnails_parent ON thumbnails(parent_id)")
                3
            }
            else -> throw IllegalStateException("No existe migración desde la versión $version")
        }
    }

    private fun createThumbnailTables(database: SQLiteDatabase) {
        database.execSQL(
            """
                CREATE TABLE thumbnail_directories (
                    path TEXT PRIMARY KEY,
                    last_accessed_at INTEGER NOT NULL
                )
            """.trimIndent()
        )
        database.execSQL(
            """
                CREATE TABLE thumbnails (
                    id TEXT PRIMARY KEY,
                    directory_path TEXT NOT NULL,
                    parent_id TEXT,
                    last_accessed_at INTEGER NOT NULL,
                    FOREIGN KEY(directory_path) REFERENCES thumbnail_directories(path) ON DELETE CASCADE,
                    FOREIGN KEY(parent_id) REFERENCES thumbnails(id)
                )
            """.trimIndent()
        )
        database.execSQL("CREATE INDEX idx_thumbnail_directories_last_accessed ON thumbnail_directories(last_accessed_at)")
        database.execSQL("CREATE INDEX idx_thumbnails_directory ON thumbnails(directory_path)")
        database.execSQL("CREATE INDEX idx_thumbnails_parent ON thumbnails(parent_id)")
        database.execSQL("CREATE INDEX idx_thumbnails_last_accessed ON thumbnails(last_accessed_at)")
    }

    companion object {
        private const val DATABASE_NAME = "file_explorer.db"
        private const val DATABASE_VERSION = 3
    }
}
