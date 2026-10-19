package com.hhrcore.fileexplorer.operation

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.hhrcore.fileexplorer.MainActivity
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import org.json.JSONObject

class FileOperationService : Service() {
    private val executor = Executors.newCachedThreadPool()
    private val activeOperations = ConcurrentHashMap.newKeySet<String>()
    private val records = mutableMapOf<String, FileOperationRecord>()
    private val pendingNotifications = linkedMapOf<String, FileOperationRecord>()
    private val displayedNotifications = mutableMapOf<String, Pair<String, String>>()
    private val pendingConfirmations = mutableMapOf<String, Int>()
    private val handler = Handler(Looper.getMainLooper())
    private var lastNotificationAt = 0L
    private var notificationScheduled = false
    private var foregroundId: String? = null
    private var latestStartId = 0
    private lateinit var store: FileOperationStore
    private lateinit var engine: FileOperationEngine

    override fun onCreate() {
        super.onCreate()
        store = FileOperationStore(this)
        engine = FileOperationEngine(store) { record ->
            val snapshot = FileOperationRecord.fromJson(JSONObject(record.toJson().toString()))
            handler.post {
                records[snapshot.id] = snapshot
                if (snapshot.status == FileOperationRecord.STATUS_PENDING || snapshot.status == FileOperationRecord.STATUS_RUNNING) {
                    enqueueNotification(snapshot)
                }
                runCatching { FileOperationEvents.emit(snapshot) }
                    .onFailure { Log.e(LOG_TAG, "Could not emit operation update", it) }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        latestStartId = startId
        val id = intent?.getStringExtra(EXTRA_ID) ?: return START_NOT_STICKY
        if (intent.action == ACTION_CANCEL) {
            val record = store.get(id)
            if (record != null && FileOperationRecord.isCancellable(record.operation)) {
                engine.cancel(id)
            }
            return START_NOT_STICKY
        }

        val token = intent.getStringExtra(EXTRA_TOKEN)
        val record = store.get(id) ?: return START_NOT_STICKY
        if (!activeOperations.add(id)) return START_NOT_STICKY
        records[id] = record
        createNotificationChannel(record)
        if (foregroundId == null) {
            promote(record)
        } else {
            enqueueNotification(record)
        }
        executor.execute {
            try {
                engine.execute(record, token)
            } catch (error: Throwable) {
                Log.e(LOG_TAG, "Could not finish operation $id", error)
            } finally {
                if (record.status == FileOperationRecord.STATUS_PENDING || record.status == FileOperationRecord.STATUS_RUNNING) {
                    record.status = FileOperationRecord.STATUS_FAILED
                    runCatching { store.save(record) }
                        .onFailure { Log.e(LOG_TAG, "Could not save operation failure", it) }
                }
                val snapshot = FileOperationRecord.fromJson(JSONObject(record.toJson().toString()))
                FileOperationStore.markInactive(id)
                handler.post { finishOperation(snapshot) }
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(record: FileOperationRecord): android.app.Notification {
        val active = record.status == FileOperationRecord.STATUS_RUNNING || record.status == FileOperationRecord.STATUS_PENDING
        val indeterminate = isIndeterminate(record)
        val progress = if (indeterminate) 0 else
            (record.bytesTransferred * 100 / record.totalBytes).coerceIn(0, 100).toInt()
        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val cancelIntent = PendingIntent.getService(
            this,
            record.id.hashCode(),
            Intent(this, FileOperationService::class.java).setAction(ACTION_CANCEL).putExtra(EXTRA_ID, record.id),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(notificationIcon(record, active))
            .setContentTitle(notificationTitle(record))
            .setContentText(notificationText(record))
            .setShowWhen(false)
            .setContentIntent(openIntent)
            .setOngoing(active)
            .setAutoCancel(!active)
            .setOnlyAlertOnce(true)
            .apply {
                if (active) {
                    setProgress(100, progress, indeterminate)
                    if (FileOperationRecord.isCancellable(record.operation)) {
                        addAction(0, record.notificationTexts.getString("cancelAction"), cancelIntent)
                    }
                } else {
                    setProgress(0, 0, false)
                }
            }
            .build()
    }

    private fun notificationIcon(record: FileOperationRecord, active: Boolean): Int {
        if (active) {
            return android.R.drawable.stat_sys_download
        }

        if (record.status == FileOperationRecord.STATUS_FAILED ||
            record.status == FileOperationRecord.STATUS_INTERRUPTED
        ) {
            return android.R.drawable.stat_notify_error
        }

        return android.R.drawable.stat_sys_download_done
    }

    private fun notificationTitle(record: FileOperationRecord): String {
        val prefix = when (record.operation) {
            FileOperationRecord.OPERATION_UPLOAD -> "upload"
            FileOperationRecord.OPERATION_DOWNLOAD -> "download"
            FileOperationRecord.OPERATION_REMOTE_MKDIR -> "remoteMkdir"
            FileOperationRecord.OPERATION_REMOTE_RENAME -> "remoteRename"
            FileOperationRecord.OPERATION_REMOTE_MOVE -> "remoteMove"
            FileOperationRecord.OPERATION_REMOTE_DELETE -> "remoteDelete"
            FileOperationRecord.OPERATION_LOCAL_MKDIR -> "localMkdir"
            FileOperationRecord.OPERATION_LOCAL_RENAME -> "localRename"
            FileOperationRecord.OPERATION_LOCAL_COPY -> "localCopy"
            FileOperationRecord.OPERATION_LOCAL_MOVE -> "localMove"
            FileOperationRecord.OPERATION_LOCAL_DELETE -> "localDelete"
            else -> "localExtract"
        }
        val suffix = when (record.status) {
            FileOperationRecord.STATUS_COMPLETED -> "Completed"
            FileOperationRecord.STATUS_FAILED -> "Failed"
            FileOperationRecord.STATUS_CANCELLED -> "Cancelled"
            FileOperationRecord.STATUS_INTERRUPTED -> "Interrupted"
            else -> "Active"
        }
        return text(record, prefix + suffix)
    }

    private fun notificationText(record: FileOperationRecord): String {
        if (record.status == FileOperationRecord.STATUS_COMPLETED) {
            return text(record, "completed")
        }

        if (record.status == FileOperationRecord.STATUS_FAILED) {
            return record.error?.optString("message")?.takeIf { it.isNotEmpty() }
                ?: text(record, "failed")
        }

        if (record.status == FileOperationRecord.STATUS_CANCELLED) return text(record, "cancelled")
        if (record.status == FileOperationRecord.STATUS_INTERRUPTED) return text(record, "interrupted")
        if (isIndeterminate(record)) {
            val key = if (record.status == FileOperationRecord.STATUS_PENDING) "pending" else "running"
            return text(record, key)
        }

        val percent = (record.bytesTransferred * 100 / record.totalBytes).coerceIn(0, 100)
        return "$percent%"
    }

    private fun isIndeterminate(record: FileOperationRecord): Boolean {
        return record.totalBytes <= 0
    }

    private fun text(record: FileOperationRecord, key: String): String = record.notificationTexts.getString(key)

    private fun updateNotification(record: FileOperationRecord) {
        getSystemService(NotificationManager::class.java).notify(notificationId(record.id), createNotification(record))
        lastNotificationAt = SystemClock.uptimeMillis()
        if (record.status == FileOperationRecord.STATUS_PENDING || record.status == FileOperationRecord.STATUS_RUNNING) {
            displayedNotifications[record.id] = notificationTitle(record) to notificationText(record)
        } else {
            displayedNotifications.remove(record.id)
        }
    }

    private fun enqueueNotification(record: FileOperationRecord) {
        val active = record.status == FileOperationRecord.STATUS_PENDING || record.status == FileOperationRecord.STATUS_RUNNING
        if (active && record.id !in pendingNotifications &&
            displayedNotifications[record.id] == (notificationTitle(record) to notificationText(record))
        ) return
        pendingNotifications[record.id] = record
        scheduleNotification()
    }

    private fun scheduleNotification() {
        if (notificationScheduled || pendingNotifications.isEmpty()) return
        val delay = (NOTIFICATION_INTERVAL - (SystemClock.uptimeMillis() - lastNotificationAt)).coerceAtLeast(0)
        notificationScheduled = true
        handler.postDelayed({
            notificationScheduled = false
            val elapsed = SystemClock.uptimeMillis() - lastNotificationAt
            if (elapsed < NOTIFICATION_INTERVAL) {
                scheduleNotification()
            } else {
                val record = pendingNotifications.entries.first().value
                pendingNotifications.remove(record.id)
                runCatching { updateNotification(record) }
                    .onFailure { Log.e(LOG_TAG, "Could not update operation notification", it) }
                if (record.id in pendingConfirmations) {
                    handler.postDelayed({ confirmFinalNotification(record) }, NOTIFICATION_INTERVAL)
                }
                scheduleNotification()
                stopWhenFinished()
            }
        }, delay)
    }

    private fun stopWhenFinished() {
        if (activeOperations.isEmpty() && pendingNotifications.isEmpty() && pendingConfirmations.isEmpty() && !notificationScheduled) {
            stopSelfResult(latestStartId)
        }
    }

    private fun confirmFinalNotification(record: FileOperationRecord) {
        val attempts = pendingConfirmations[record.id] ?: return
        val notification = runCatching {
            getSystemService(NotificationManager::class.java).activeNotifications
                .firstOrNull { it.id == notificationId(record.id) && it.tag == null }?.notification
        }.onFailure { Log.e(LOG_TAG, "Could not inspect operation notification", it) }.getOrNull()
        if (notification == null ||
            (notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() == notificationTitle(record) &&
                notification.flags and Notification.FLAG_ONGOING_EVENT == 0)
        ) {
            pendingConfirmations.remove(record.id)
        } else if (attempts < FINAL_NOTIFICATION_RETRIES) {
            pendingConfirmations[record.id] = attempts + 1
            enqueueNotification(record)
        } else {
            Log.e(LOG_TAG, "Could not confirm final operation notification ${record.id}")
            pendingConfirmations.remove(record.id)
        }

        stopWhenFinished()
    }

    private fun finishOperation(record: FileOperationRecord) {
        val id = record.id
        activeOperations.remove(id)
        records.remove(id)
        if (foregroundId == id) {
            stopForeground(STOP_FOREGROUND_DETACH)
            foregroundId = null
            val remainingRecord = activeOperations.asSequence().mapNotNull(records::get).firstOrNull {
                it.status == FileOperationRecord.STATUS_PENDING || it.status == FileOperationRecord.STATUS_RUNNING
            }
            if (remainingRecord != null) promote(remainingRecord)
        }

        pendingConfirmations[id] = 0
        enqueueNotification(record)
        runCatching { FileOperationEvents.emit(record) }
            .onFailure { Log.e(LOG_TAG, "Could not emit final operation update", it) }
        stopWhenFinished()
    }

    private fun promote(record: FileOperationRecord) {
        startForeground(notificationId(record.id), createNotification(record))
        lastNotificationAt = SystemClock.uptimeMillis()
        displayedNotifications[record.id] = notificationTitle(record) to notificationText(record)
        foregroundId = record.id
    }

    private fun createNotificationChannel(record: FileOperationRecord) {
        val channel = NotificationChannel(CHANNEL_ID, text(record, "channelName"), NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "file_operations"
        private const val LOG_TAG = "FileOperationService"
        private const val NOTIFICATION_ID_BASE = 4102
        private const val NOTIFICATION_INTERVAL = 1500L
        private const val FINAL_NOTIFICATION_RETRIES = 3
        private const val ACTION_START = "com.hhrcore.fileexplorer.operation.START"
        private const val ACTION_CANCEL = "com.hhrcore.fileexplorer.operation.CANCEL"
        private const val EXTRA_ID = "operationId"
        private const val EXTRA_TOKEN = "accessToken"

        private fun notificationId(id: String): Int = NOTIFICATION_ID_BASE + (id.hashCode() and 0x00ffffff)

        fun start(context: Context, id: String, token: String?) {
            val intent = Intent(context, FileOperationService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_ID, id)
            token?.let { intent.putExtra(EXTRA_TOKEN, it) }
            ContextCompat.startForegroundService(context, intent)
        }

        fun cancel(context: Context, id: String) {
            context.startService(Intent(context, FileOperationService::class.java).setAction(ACTION_CANCEL).putExtra(EXTRA_ID, id))
        }
    }
}
