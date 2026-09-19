package com.mybusiness.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.webkit.JavascriptInterface
import android.webkit.WebView
import dev.ffmpegkit.llama.Llama
import dev.ffmpegkit.llama.LlamaConfig
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

class QwenNativeBridge(private val context: Context, private val web: WebView) {
    companion object {
        private const val MODEL_URL = "https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf?download=true"
        private const val MODEL_FILE = "Qwen3-0.6B-Q4_0.gguf"
        private const val EXPECTED_BYTES = 428970080L
        private const val EXPECTED_SHA256 = "da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val generating = AtomicBoolean(false)
    private var model: dev.ffmpegkit.llama.LlamaModel? = null
    private var closed = false

    fun start() { scope.launch { prepareModel() } }

    @JavascriptInterface fun generate(prompt: String, requestId: String) {
        if (closed) return
        if (!generating.compareAndSet(false, true)) { result(requestId, "{\"error\":\"AI is busy. Please wait.\"}"); return }
        scope.launch {
            try {
                val loaded = model ?: throw IllegalStateException("Local Qwen model is not ready yet.")
                val r = Llama.complete(loaded, prompt = prompt, systemPrompt = "You are a strict JSON command parser. Never output code.", maxTokens = 320)
                result(requestId, JSONObject().put("text", r.text).put("tokensPerSecond", r.tokensPerSecond).toString())
            } catch (e: Throwable) { result(requestId, JSONObject().put("error", e.message ?: "Inference failed").toString()) }
            finally { generating.set(false) }
        }
    }

    @JavascriptInterface fun getStatus(): String = statusJson("ready".takeIf { model != null } ?: "starting", "Qwen3 0.6B local AI")

    private suspend fun prepareModel() {
        status("checking", "Checking local Qwen3 model…")
        val dir = File(context.getExternalFilesDir(null), "models")
        if (!dir.exists()) dir.mkdirs()
        val file = File(dir, MODEL_FILE)
        try {
            if (!validModel(file)) {
                if (file.exists()) file.delete()
                download(file)
            }
            status("initializing", "Initializing local Qwen3…")
            model = Llama.loadModel(file.absolutePath, LlamaConfig(contextSize = 2048, threads = minOf(4, Runtime.getRuntime().availableProcessors())))
            status("ready", "Qwen3 0.6B ready • offline inference")
        } catch (e: Throwable) {
            status("failed", "AI setup failed: ${e.message ?: "unknown error"}")
        }
    }

    private fun validModel(file: File): Boolean {
        if (!file.exists() || file.length() != EXPECTED_BYTES) return false
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input -> val buf = ByteArray(1024 * 1024); while (true) { val n=input.read(buf); if(n<0)break; digest.update(buf,0,n) } }
        return digest.digest().joinToString("") { "%02x".format(it) } == EXPECTED_SHA256
    }

    private suspend fun download(target: File) = withContext(Dispatchers.IO) {
        if (!networkAvailable()) throw IllegalStateException("Internet is required only for the first model download.")
        val part = File(target.parentFile, target.name + ".part")
        var existing = if (part.exists()) part.length() else 0L
        status("downloading", "Downloading Qwen3 0.6B… 0%")
        var conn: HttpURLConnection? = null
        try {
            conn = URL(MODEL_URL).openConnection() as HttpURLConnection
            conn.connectTimeout = 20000; conn.readTimeout = 30000
            if (existing > 0) conn.setRequestProperty("Range", "bytes=$existing-")
            conn.connect()
            if (existing > 0 && conn.responseCode != HttpURLConnection.HTTP_PARTIAL) { existing=0; part.delete(); conn.disconnect(); conn=URL(MODEL_URL).openConnection() as HttpURLConnection; conn.connectTimeout=20000; conn.readTimeout=30000; conn.connect() }
            if (conn.responseCode !in 200..299) throw IllegalStateException("Model download HTTP ${conn.responseCode}")
            val total = if (conn.responseCode == HttpURLConnection.HTTP_PARTIAL) existing + conn.contentLengthLong else conn.contentLengthLong
            if (total > 0 && total != EXPECTED_BYTES) throw IllegalStateException("Unexpected model size: $total bytes")
            conn.inputStream.use { input -> RandomAccessFile(part,"rw").use { out -> out.seek(existing); val buf=ByteArray(1024*1024); var done=existing; var last=0L; while(true){val n=input.read(buf);if(n<0)break;out.write(buf,0,n);done+=n;if(System.currentTimeMillis()-last>400){last=System.currentTimeMillis();val pct=if(total>0)(done*100/total).toInt() else 0;status("downloading","Downloading Qwen3 0.6B… $pct%")}} } }
            if (part.length()!=EXPECTED_BYTES) throw IllegalStateException("Incomplete model download")
            status("verifying", "Verifying Qwen3 model…")
            val digest=MessageDigest.getInstance("SHA-256");part.inputStream().use { input -> val buf=ByteArray(1024*1024);while(true){val n=input.read(buf);if(n<0)break;digest.update(buf,0,n)} }
            val sha=digest.digest().joinToString(""){ "%02x".format(it) };if(sha!=EXPECTED_SHA256)throw IllegalStateException("Model checksum mismatch")
            if(target.exists())target.delete();if(!part.renameTo(target))throw IllegalStateException("Could not finalize model file")
        } finally { conn?.disconnect() }
    }

    private fun networkAvailable(): Boolean {
        val cm=context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val n=cm.activeNetwork ?: return false
        val caps=cm.getNetworkCapabilities(n) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
    private fun status(state:String,text:String){val payload=statusJson(state,text);web.post{web.evaluateJavascript("window.__mybizQwenStatusUpdate(${JSONObject.quote(payload)});",null)}}
    private fun result(id:String,payload:String){web.post{web.evaluateJavascript("window.__mybizQwenResult(${JSONObject.quote(id)},${JSONObject.quote(payload)});",null)}}
    private fun statusJson(state:String,text:String)=JSONObject().put("state",state).put("text",text).toString()
    fun close(){closed=true;model?.let{m->scope.launch{try{Llama.releaseModel(m)}catch(_:Throwable){}}};model=null;scope.cancel()}
}
