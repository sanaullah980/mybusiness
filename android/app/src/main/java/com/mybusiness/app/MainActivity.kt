package com.mybusiness.app

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import dev.ffmpegkit.llama.Llama
import dev.ffmpegkit.llama.LlamaConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var ai: LocalAi

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        WebView.setWebContentsDebuggingEnabled(false)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.mediaPlaybackRequiresUserGesture = true
        settings.setSupportMultipleWindows(false)
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) view.evaluateJavascript("window.NativeAI?.webError?.(${JSONObject.quote(error.description.toString())})", null)
            }
        }
        webView.webChromeClient = WebChromeClient()

        ai = LocalAi(this, webView)
        webView.addJavascriptInterface(ai, "AndroidAI")
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        ai.prepare()
    }

    override fun onDestroy() {
        ai.close()
        webView.removeJavascriptInterface("AndroidAI")
        webView.destroy()
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}

class LocalAi(private val activity: Activity, private val webView: WebView) {
    companion object {
        const val MODEL_NAME = "Qwen3-0.6B-Q4_0.gguf"
        const val MODEL_URL = "https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf?download=true"
        const val MODEL_SHA256 = "da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4"
        const val EXPECTED_BYTES = 429_000_000L
    }
    private var model: dev.ffmpegkit.llama.LlamaModel? = null
    private val closed = AtomicBoolean(false)
    private val busy = AtomicBoolean(false)
    private val modelFile get() = File(activity.getExternalFilesDir("models"), MODEL_NAME)
    private val partialFile get() = File(activity.getExternalFilesDir("models"), "$MODEL_NAME.part")

    fun prepare() {
        activity.lifecycleScope.launch(Dispatchers.IO) {
            try {
                notifyJs("state", JSONObject().put("status","checking").toString())
                val valid = modelFile.exists() && modelFile.length() >= EXPECTED_BYTES && sha256(modelFile).equals(MODEL_SHA256, true)
                if (!valid) downloadModel()
                notifyJs("state", JSONObject().put("status","loading").toString())
                val loaded = Llama.loadModel(modelFile.absolutePath, LlamaConfig(contextSize = 2048, threads = maxOf(2, Runtime.getRuntime().availableProcessors().coerceAtMost(6))))
                model = loaded
                notifyJs("state", JSONObject().put("status","ready").put("model",MODEL_NAME).toString())
            } catch (e: Throwable) {
                notifyJs("state", JSONObject().put("status","error").put("message",e.message ?: "AI initialization failed").toString())
            }
        }
    }

    private fun downloadModel() {
        modelFile.parentFile?.mkdirs()
        if (partialFile.exists() && partialFile.length() > EXPECTED_BYTES) partialFile.delete()
        var existing = if (partialFile.exists()) partialFile.length() else 0L
        val conn = (URL(MODEL_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20000; readTimeout = 60000; instanceFollowRedirects = true
            if (existing > 0) setRequestProperty("Range", "bytes=$existing-")
        }
        conn.connect()
        val append = existing > 0 && conn.responseCode == HttpURLConnection.HTTP_PARTIAL
        if (!append) { existing = 0; partialFile.delete() }
        val total = (if (append) existing else 0) + conn.contentLengthLong.coerceAtLeast(0)
        conn.inputStream.use { input ->
            RandomAccessFile(partialFile, "rw").use { out ->
                out.seek(existing)
                val buf = ByteArray(1024 * 1024)
                var done = existing
                var last = -1
                while (true) {
                    val n = input.read(buf); if (n <= 0) break
                    out.write(buf,0,n); done += n
                    if (total > 0) {
                        val pct = ((done * 100L) / total).toInt().coerceIn(0,100)
                        if (pct != last) { last=pct; notifyJs("download", JSONObject().put("percent",pct).put("bytes",done).put("total",total).toString()) }
                    }
                }
            }
        }
        conn.disconnect()
        if (total > 0 && partialFile.length() < total) throw IllegalStateException("Model download incomplete")
        if (partialFile.length() < EXPECTED_BYTES) throw IllegalStateException("Downloaded model is incomplete")
        if (!sha256(partialFile).equals(MODEL_SHA256,true)) { partialFile.delete(); throw IllegalStateException("Model checksum verification failed") }
        if (modelFile.exists()) modelFile.delete()
        if (!partialFile.renameTo(modelFile)) throw IllegalStateException("Could not finalize model file")
    }

    @JavascriptInterface
    fun status(): String = JSONObject().put("ready", model != null).put("model", MODEL_NAME).toString()

    @JavascriptInterface
    fun ask(requestId: String, prompt: String, systemPrompt: String) {
        if (model == null) { notifyJs("result", JSONObject().put("id",requestId).put("ok",false).put("error","AI model is not ready yet.").toString()); return }
        if (!busy.compareAndSet(false,true)) { notifyJs("result", JSONObject().put("id",requestId).put("ok",false).put("error","AI is still processing the previous request.").toString()); return }
        activity.lifecycleScope.launch(Dispatchers.IO) {
            try {
                val result = Llama.complete(model!!, prompt = prompt, systemPrompt = systemPrompt, maxTokens = 384)
                notifyJs("result", JSONObject().put("id",requestId).put("ok",true).put("text",result.text).put("tokensPerSecond",result.tokensPerSecond).toString())
            } catch (e: Throwable) {
                notifyJs("result", JSONObject().put("id",requestId).put("ok",false).put("error",e.message ?: "Inference failed").toString())
            } finally { busy.set(false) }
        }
    }

    private fun notifyJs(kind: String, payload: String) {
        if (closed.get()) return
        activity.runOnUiThread { webView.evaluateJavascript("window.NativeAI && window.NativeAI._event(${JSONObject.quote(kind)},${JSONObject.quote(payload)})", null) }
    }
    private fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input -> val b=ByteArray(1024*1024); while(true){val n=input.read(b);if(n<0)break;md.update(b,0,n)} }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
    fun close() { closed.set(true); model?.let { try { Llama.releaseModel(it) } catch (_: Throwable) {} }; model=null }
}
