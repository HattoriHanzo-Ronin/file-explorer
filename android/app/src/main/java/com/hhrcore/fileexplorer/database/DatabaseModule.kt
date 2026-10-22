package com.hhrcore.fileexplorer.database

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DatabaseModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val executor: ExecutorService
    private val helper: ExplorerDatabaseHelper

    init {
        executor = Executors.newSingleThreadExecutor()
        helper = ExplorerDatabaseHelper(context)
    }

    override fun getName() = "Database"

    @ReactMethod
    fun insert(table: String, values: ReadableMap, promise: Promise) {
        execute(promise) {
            val id = helper.writableDatabase.insertOrThrow(table.identifier(), null, values.toContentValues())
            promise.resolve(id.toDouble())
        }
    }

    @ReactMethod
    fun update(table: String, values: ReadableMap, where: ReadableMap, promise: Promise) {
        execute(promise) {
            val condition = where.toCondition()
            val count = helper.writableDatabase.update(table.identifier(), values.toContentValues(), condition.clause, condition.arguments)
            promise.resolve(count.toDouble())
        }
    }

    @ReactMethod
    fun delete(table: String, where: ReadableMap, promise: Promise) {
        execute(promise) {
            val condition = where.toCondition()
            val count = helper.writableDatabase.delete(table.identifier(), condition.clause, condition.arguments)
            promise.resolve(count.toDouble())
        }
    }

    @ReactMethod
    fun query(table: String, options: ReadableMap?, promise: Promise) {
        execute(promise) {
            val columns = options?.getArray("columns")?.toIdentifiers()
            val where = options?.getMap("where")?.toCondition()
            val orderBy = options?.getMap("orderBy")?.toOrderBy()
            val limit = options?.takeIf { it.hasKey("limit") && !it.isNull("limit") }?.getDouble("limit")?.toInt()
            helper.readableDatabase.query(
                table.identifier(),
                columns,
                where?.clause,
                where?.arguments,
                null,
                null,
                orderBy,
                limit?.toString()
            ).use { cursor -> promise.resolve(cursor.toRows()) }
        }
    }

    @ReactMethod
    fun getById(table: String, id: ReadableMap, column: String, promise: Promise) {
        execute(promise) {
            val key = column.identifier()
            if (!id.hasKey("value")) {
                throw IllegalArgumentException("Falta el identificador")
            }

            val condition = mapOf(key to id.value("value")).toCondition()
            helper.readableDatabase.query(
                table.identifier(),
                null,
                condition.clause,
                condition.arguments,
                null,
                null,
                null,
                "1"
            ).use { cursor -> promise.resolve(if (cursor.moveToFirst()) cursor.toRow() else null) }
        }
    }

    @ReactMethod
    fun executeTransaction(operations: ReadableArray, promise: Promise) {
        execute(promise) {
            helper.writableDatabase.transaction {
                for (index in 0 until operations.size()) {
                    val operation = operations.getMap(index) ?: throw IllegalArgumentException("Operación de base de datos inválida")
                    executeMutation(operation)
                }
            }
            promise.resolve(null)
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        helper.close()
        super.invalidate()
    }

    private fun executeMutation(operation: ReadableMap) {
        val table = operation.getString("table")?.identifier() ?: throw IllegalArgumentException("Falta la tabla")
        when (operation.getString("type")) {
            "insert" -> {
                val values = operation.getMap("values") ?: throw IllegalArgumentException("Faltan los valores")
                helper.writableDatabase.insertOrThrow(table, null, values.toContentValues())
            }
            "update" -> {
                val values = operation.getMap("values") ?: throw IllegalArgumentException("Faltan los valores")
                val where = operation.getMap("where") ?: throw IllegalArgumentException("Falta la condición")
                val condition = where.toCondition()
                helper.writableDatabase.update(table, values.toContentValues(), condition.clause, condition.arguments)
            }
            "delete" -> {
                val where = operation.getMap("where") ?: throw IllegalArgumentException("Falta la condición")
                val condition = where.toCondition()
                helper.writableDatabase.delete(table, condition.clause, condition.arguments)
            }
            else -> throw IllegalArgumentException("Operación de base de datos inválida")
        }
    }

    private fun execute(promise: Promise, operation: () -> Unit) {
        executor.execute {
            try {
                operation()
            } catch (error: Throwable) {
                promise.reject("DATABASE_ERROR", error.message, error)
            }
        }
    }

    private fun SQLiteDatabase.transaction(operation: SQLiteDatabase.() -> Unit) {
        beginTransaction()
        try {
            operation()
            setTransactionSuccessful()
        } finally {
            endTransaction()
        }
    }

    private fun String.identifier(): String {
        if (!IDENTIFIER_REGEX.matches(this)) {
            throw IllegalArgumentException("Identificador de base de datos inválido")
        }

        return this
    }

    private fun ReadableArray.toIdentifiers(): Array<String> {
        return Array(size()) { index -> getString(index)?.identifier() ?: throw IllegalArgumentException("Columna inválida") }
    }

    private fun ReadableMap.toContentValues(): ContentValues {
        return ContentValues().also { values ->
            val iterator = keySetIterator()
            while (iterator.hasNextKey()) {
                val key = iterator.nextKey().identifier()
                when (getType(key)) {
                    ReadableType.Boolean -> values.put(key, getBoolean(key))
                    ReadableType.Number -> values.put(key, getDouble(key))
                    ReadableType.String -> values.put(key, getString(key))
                    ReadableType.Null -> values.putNull(key)
                    else -> throw IllegalArgumentException("Valor de base de datos inválido")
                }
            }
        }
    }

    private fun ReadableMap.toCondition(): DatabaseCondition {
        return toMap().toCondition()
    }

    private fun Map<String, Any?>.toCondition(): DatabaseCondition {
        if (isEmpty()) {
            throw IllegalArgumentException("La condición no puede estar vacía")
        }

        val clauses = mutableListOf<String>()
        val arguments = mutableListOf<String>()
        forEach { (column, value) ->
            val key = column.identifier()
            if (value == null) {
                clauses.add("$key IS NULL")
            } else {
                clauses.add("$key = ?")
                arguments.add(
                    when (value) {
                        is Boolean -> if (value) "1" else "0"
                        else -> value.toString()
                    }
                )
            }
        }
        return DatabaseCondition(clauses.joinToString(" AND "), arguments.toTypedArray())
    }

    private fun ReadableMap.toMap(): Map<String, Any?> {
        val values = linkedMapOf<String, Any?>()
        val iterator: ReadableMapKeySetIterator = keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            values[key] = when (getType(key)) {
                ReadableType.Boolean -> getBoolean(key)
                ReadableType.Number -> getDouble(key)
                ReadableType.String -> getString(key)
                ReadableType.Null -> null
                else -> throw IllegalArgumentException("Valor de base de datos inválido")
            }
        }
        return values
    }

    private fun ReadableMap.value(key: String): Any? {
        return when (getType(key)) {
            ReadableType.Boolean -> getBoolean(key)
            ReadableType.Number -> getDouble(key)
            ReadableType.String -> getString(key)
            ReadableType.Null -> null
            else -> throw IllegalArgumentException("Valor de base de datos inválido")
        }
    }

    private fun ReadableMap.toOrderBy(): String {
        val column = getString("column")?.identifier() ?: throw IllegalArgumentException("Falta la columna de ordenación")
        return "$column ${if (hasKey("descending") && getBoolean("descending")) "DESC" else "ASC"}"
    }

    private fun Cursor.toRows(): WritableArray {
        return Arguments.createArray().apply {
            while (moveToNext()) {
                pushMap(toRow())
            }
        }
    }

    private fun Cursor.toRow(): WritableMap {
        return Arguments.createMap().apply {
            for (index in 0 until columnCount) {
                when (getType(index)) {
                    Cursor.FIELD_TYPE_NULL -> putNull(getColumnName(index))
                    Cursor.FIELD_TYPE_INTEGER -> putDouble(getColumnName(index), getLong(index).toDouble())
                    Cursor.FIELD_TYPE_FLOAT -> putDouble(getColumnName(index), getDouble(index))
                    Cursor.FIELD_TYPE_STRING -> putString(getColumnName(index), getString(index))
                    else -> throw IllegalArgumentException("Tipo de base de datos no compatible")
                }
            }
        }
    }

    private data class DatabaseCondition(val clause: String, val arguments: Array<String>)

    companion object {
        private val IDENTIFIER_REGEX = Regex("[A-Za-z_][A-Za-z0-9_]*")
    }
}
