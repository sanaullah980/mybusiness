package com.mybusiness.app

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.net.Uri
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat
import dev.ffmpegkit.whisper.Whisper
import dev.ffmpegkit.whisper.WhisperConfig
import dev.ffmpegkit.whisper.WhisperModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/**
 * LocalWhisper mirrors the existing LocalAi/Qwen architecture:
 * - user gets the official model in a browser
 * - user returns to MyBusiness and imports the model
 * - the file is copied to app-private storage
 * - size + SHA-256 are verified
 * - the verified model is loaded locally
 * - audio is recorded locally and transcribed on-device
 * - no audio/model data is uploaded by this class
 */
class LocalWhisper(
    private val activity: MainActivity,
    private val eventListener: (String, String) -> Unit
) {
    companion object {
        const val MODEL_NAME = "ggml-base.bin"
        const val MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true"
        // Official ggerganov/whisper.cpp ggml-base.bin: 147,951,465 bytes.
        const val EXPECTED_BYTES = 147_951_465L
        const val MODEL_SHA256 = "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"
        const val MIN_REASONABLE_BYTES = 100_000_000L
        const val MAX_REASONABLE_BYTES = 200_000_000L
        const val SAMPLE_RATE = 16_000
    }

    private var model: WhisperModel? = null
    private val loading = AtomicBoolean(false)
    private val busy = AtomicBoolean(false)
    private val recording = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)

    private val modelDir = File(activity.filesDir, "models")
    private val modelFile get() = File(modelDir, MODEL_NAME)
    private val tempFile get() = File(modelDir, "$MODEL_NAME.installing")
    private val markerFile get() = File(modelDir, "$MODEL_NAME.verified")
    private val audioFile get() = File(activity.cacheDir, "mybusiness-whisper-input.wav")

    private var recorder: AudioRecord? = null
    private var recordingThread: Thread? = null
    private var pcmBytesWritten = 0L

    fun currentStatus(): String = when {
        model != null -> "ready"
        isInstalledAndVerified() -> "installed"
        else -> "not_installed"
    }

    @JavascriptInterface
    fun status(): String {
        return JSONObject()
            .put("ready", model != null)
            .put("installed", isInstalledAndVerified())
            .put("status", currentStatus())
            .put("model", MODEL_NAME)
            .put("size", EXPECTED_BYTES)
            .put("sha256", MODEL_SHA256)
            .put("recording", recording.get())
            .toString()
    }

    @JavascriptInterface
    fun openModelPicker() {
        activity.runOnUiThread { activity.launchWhisperModelPicker() }
    }

    @JavascriptInterface
    fun openModelDownloadPage() {
        activity.runOnUiThread { activity.openWhisperModelDownloadPage() }
    }

    @JavascriptInterface
    fun load() {
        loadModelIfNeeded()
    }

    @JavascriptInterface
    fun setLanguage(language: String) {
        activity.setWhisperLanguage(language)
    }

    @JavascriptInterface
    fun startRecording() {
        activity.runOnUiThread {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED
            ) {
                startRecordingInternal()
            } else {
                activity.requestWhisperMicrophonePermission()
            }
        }
    }

    @JavascriptInterface
    fun stopRecording() {
        activity.runOnUiThread { stopRecordingInternal() }
    }

    fun onMicrophonePermissionResult(granted: Boolean) {
        if (granted) startRecordingInternal()
        else notifyJs("error", JSONObject().put("message", "Microphone permission is required for voice commands.").toString())
    }

    fun installFromUri(uri: Uri) {
        activity.lifecycleScope.launch(Dispatchers.IO) {
            try {
                modelDir.mkdirs()
                notifyJs("state", JSONObject().put("status", "checking").put("message", "Checking Whisper model...").toString())

                val reportedSize = querySize(uri)
                if (reportedSize > 0 && (reportedSize < MIN_REASONABLE_BYTES || reportedSize > MAX_REASONABLE_BYTES)) {
                    throw IllegalArgumentException("The selected file is not a Whisper base model (unexpected size).")
                }
                tempFile.delete()
                copyUriToTemp(uri, reportedSize)
                val actualSize = tempFile.length()
                if (actualSize < MIN_REASONABLE_BYTES || actualSize > MAX_REASONABLE_BYTES) {
                    throw IllegalArgumentException("The selected file is not a Whisper base model (unexpected size).")
                }
                notifyJs("state", JSONObject().put("status", "verifying").put("message", "Verifying Whisper model...").toString())
                if (!hasGgmlMagic(tempFile)) {
                    throw IllegalArgumentException("The selected file is not a Whisper GGML model (missing 'ggml' header).")
                }

                notifyJs("state", JSONObject().put("status", "verifying").put("message", "Verifying Whisper model with the native Whisper loader...").toString())
                val newLoaded = try {
                    Whisper.loadModel(activity, tempFile.absolutePath)
                } catch (e: Throwable) {
                    throw IllegalArgumentException("The selected file could not be loaded as a valid Whisper GGML base model.", e)
                }
                val backup = File(modelDir, "$MODEL_NAME.previous")
                backup.delete()
                val hadOld = modelFile.exists()
                if (hadOld && !modelFile.renameTo(backup)) {
                    Whisper.releaseModel(newLoaded)
                    throw IllegalStateException("Could not safely replace the existing Whisper model.")
                }
                if (!tempFile.renameTo(modelFile)) {
                    if (hadOld) backup.renameTo(modelFile)
                    Whisper.releaseModel(newLoaded)
                    throw IllegalStateException("Could not finalize the Whisper model file.")
                }

                val oldLoaded = model
                model = newLoaded
                if (oldLoaded != null) runCatching { Whisper.releaseModel(oldLoaded) }
                markerFile.writeText("$MODEL_SHA256\n${modelFile.length()}\n")
                backup.delete()

                notifyJs("state", JSONObject()
                    .put("status", "ready")
                    .put("message", "Whisper Ready")
                    .put("model", MODEL_NAME)
                    .toString())
            } catch (t: Throwable) {
                tempFile.delete()
                notifyJs("state", JSONObject()
                    .put("status", if (isInstalledAndVerified()) "installed" else "not_installed")
                    .put("message", t.message ?: "Whisper installation failed.")
                    .toString())
                notifyJs("error", JSONObject().put("message", t.message ?: "Whisper installation failed.").toString())
            }
        }
    }

    private fun startRecordingInternal() {
        if (closed.get()) return
        if (!isInstalledAndVerified()) {
            notifyJs("error", JSONObject().put("message", "Install the Whisper model before using voice commands.").toString())
            return
        }
        if (recording.get()) return

        val minBuffer = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBuffer <= 0) {
            notifyJs("error", JSONObject().put("message", "This device does not provide a usable microphone configuration.").toString())
            return
        }

        try {
            audioFile.parentFile?.mkdirs()
            recorder = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                max(minBuffer * 2, 16_384)
            )

            if (recorder?.state != AudioRecord.STATE_INITIALIZED) {
                recorder?.release()
                recorder = null
                throw IllegalStateException("Could not initialize the microphone.")
            }

            pcmBytesWritten = 0L
            recording.set(true)
            recorder!!.startRecording()
            notifyJs("state", JSONObject().put("status", "recording").put("message", "Listening...").toString())

            recordingThread = Thread {
                try {
                    RandomAccessFile(audioFile, "rw").use { out ->
                        writeWavHeader(out, 0)
                        val buffer = ShortArray(4096)

                        while (recording.get() && !closed.get()) {
                            val count = recorder?.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING) ?: -1
                            if (count <= 0) continue

                            val bytes = ByteArray(count * 2)
                            var j = 0
                            for (i in 0 until count) {
                                val value = buffer[i].toInt()
                                bytes[j++] = (value and 0xff).toByte()
                                bytes[j++] = ((value shr 8) and 0xff).toByte()
                            }
                            out.write(bytes)
                            pcmBytesWritten += bytes.size
                        }

                        out.seek(0)
                        writeWavHeader(out, pcmBytesWritten)
                    }
                } catch (t: Throwable) {
                    if (!closed.get()) {
                        recording.set(false)
                        notifyJs("error", JSONObject().put("message", t.message ?: "Microphone recording failed.").toString())
                    }
                }
            }.also { it.start() }
        } catch (t: Throwable) {
            recording.set(false)
            recorder?.release()
            recorder = null
            notifyJs("error", JSONObject().put("message", t.message ?: "Could not start microphone.").toString())
        }
    }

    private fun stopRecordingInternal() {
        if (!recording.getAndSet(false)) return

        try {
            recorder?.stop()
        } catch (_: Throwable) {
        }
        recordingThread?.join(1500)
        recordingThread = null
        recorder?.release()
        recorder = null

        if (!audioFile.exists() || pcmBytesWritten < SAMPLE_RATE / 2L) {
            notifyJs("error", JSONObject().put("message", "No usable speech was recorded.").toString())
            return
        }

        transcribeRecordedAudio()
    }

    private fun transcribeRecordedAudio() {
        loadModelIfNeeded {
            if (model == null) {
                notifyJs("error", JSONObject().put("message", "Whisper model is not installed or could not be loaded.").toString())
                return@loadModelIfNeeded
            }
            if (!busy.compareAndSet(false, true)) return@loadModelIfNeeded

            activity.lifecycleScope.launch(Dispatchers.IO) {
                try {
                    notifyJs("state", JSONObject().put("status", "transcribing").put("message", "Understanding speech...").toString())
                    val language = activity.getWhisperLanguage()
                    val config = if (language == "auto") WhisperConfig() else WhisperConfig(language = language)
                    val result = Whisper.transcribe(model!!, audioFile.absolutePath, config)
                    notifyJs("result", JSONObject()
                        .put("text", result.text.trim())
                        .put("language", language)
                        .toString())
                    notifyJs("state", JSONObject().put("status", "ready").put("message", "Whisper Ready").toString())
                } catch (t: Throwable) {
                    notifyJs("error", JSONObject().put("message", t.message ?: "Speech transcription failed.").toString())
                } finally {
                    busy.set(false)
                    audioFile.delete()
                }
            }
        }
    }

    private fun loadModelIfNeeded(after: (() -> Unit)? = null) {
        if (model != null) {
            after?.invoke()
            return
        }
        if (!isInstalledAndVerified()) {
            notifyJs("state", JSONObject().put("status", "not_installed").put("message", "Whisper model is not installed.").toString())
            after?.invoke()
            return
        }
        if (!loading.compareAndSet(false, true)) return

        activity.lifecycleScope.launch(Dispatchers.IO) {
            try {
                notifyJs("state", JSONObject().put("status", "loading").put("message", "Loading Whisper...").toString())
                model = Whisper.loadModel(activity, modelFile.absolutePath)
                notifyJs("state", JSONObject().put("status", "ready").put("message", "Whisper Ready").toString())
            } catch (t: Throwable) {
                notifyJs("state", JSONObject().put("status", "error").put("message", t.message ?: "Could not load Whisper.").toString())
            } finally {
                loading.set(false)
                withContext(Dispatchers.Main) { after?.invoke() }
            }
        }
    }

    private fun copyUriToTemp(uri: Uri, total: Long) {
        val resolver = activity.contentResolver
        resolver.openInputStream(uri)?.use { input ->
            tempFile.outputStream().use { output ->
                val buffer = ByteArray(1024 * 1024)
                var copied = 0L
                var lastPercent = -1
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    output.write(buffer, 0, count)
                    copied += count
                    // Some Android document providers report a stale/wrong
                    // size. Never allow the UI to show an impossible percentage.
                    val percent = if (total > 0) {
                        ((copied * 100L) / total).toInt().coerceIn(0, 100)
                    } else -1
                    if (percent != lastPercent) {
                        lastPercent = percent
                        notifyJs("install", JSONObject().put("percent", percent).put("bytes", copied).put("total", total).toString())
                    }
                }
                output.flush()
            }
        } ?: throw IllegalStateException("The selected model could not be read.")
    }

    private fun queryDisplayName(uri: Uri): String {
        var result = uri.lastPathSegment ?: "model.bin"
        activity.contentResolver.query(uri, arrayOf("_display_name"), null, null, null)?.use { c ->
            if (c.moveToFirst()) result = c.getString(0) ?: result
        }
        return result
    }

    private fun querySize(uri: Uri): Long {
        activity.contentResolver.query(uri, arrayOf("_size"), null, null, null)?.use { c ->
            if (c.moveToFirst() && !c.isNull(0)) return c.getLong(0)
        }
        return activity.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
    }

    private fun isInstalledAndVerified(): Boolean {
        if (!modelFile.exists() || !markerFile.exists()) return false
        val marker = runCatching { markerFile.readText() }.getOrNull() ?: return false
        return modelFile.length() in MIN_REASONABLE_BYTES..MAX_REASONABLE_BYTES &&
            marker.equals(sha256(modelFile), ignoreCase = true)
    }

    private fun hasGgmlMagic(file: File): Boolean {
        // ggml files are written with `struct.pack("i", 0x67676d6c)` (native/little-endian
        // int32), so on disk the magic reads as bytes 'l','m','g','g' — NOT 'g','g','m','l'.
        file.inputStream().use { input ->
            val b = ByteArray(4)
            if (input.read(b) != 4) return false
            return b[0] == 'l'.code.toByte() &&
                b[1] == 'm'.code.toByte() &&
                b[2] == 'g'.code.toByte() &&
                b[3] == 'g'.code.toByte()
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun writeWavHeader(file: RandomAccessFile, dataLength: Long) {
        val byteRate = SAMPLE_RATE * 2L
        file.seek(0)
        file.writeBytes("RIFF")
        file.writeIntLE((36L + dataLength).toInt())
        file.writeBytes("WAVE")
        file.writeBytes("fmt ")
        file.writeIntLE(16)
        file.writeShortLE(1)
        file.writeShortLE(1)
        file.writeIntLE(SAMPLE_RATE)
        file.writeIntLE(byteRate.toInt())
        file.writeShortLE(2)
        file.writeShortLE(16)
        file.writeBytes("data")
        file.writeIntLE(dataLength.toInt())
    }

    private fun RandomAccessFile.writeIntLE(value: Int) {
        write(byteArrayOf(
            (value and 0xff).toByte(),
            ((value shr 8) and 0xff).toByte(),
            ((value shr 16) and 0xff).toByte(),
            ((value shr 24) and 0xff).toByte()
        ))
    }

    private fun RandomAccessFile.writeShortLE(value: Int) {
        write(byteArrayOf(
            (value and 0xff).toByte(),
            ((value shr 8) and 0xff).toByte()
        ))
    }

    fun close() {
        closed.set(true)
        recording.set(false)
        runCatching { recorder?.stop() }
        recorder?.release()
        recorder = null
        recordingThread?.interrupt()
        recordingThread = null
        model?.let { runCatching { Whisper.releaseModel(it) } }
        model = null
        audioFile.delete()
    }

    fun notifyJs(kind: String, payload: String) {
        if (closed.get()) return
        activity.runOnUiThread { if (!closed.get()) eventListener(kind, payload) }
    }
}
