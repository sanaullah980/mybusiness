package com.mybusiness.app

import android.annotation.SuppressLint
import android.app.Dialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import dev.ffmpegkit.llama.Llama
import dev.ffmpegkit.llama.LlamaConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var ai: LocalAi
    private val webUrl = "https://mybusiness-green.vercel.app/"

    private val modelPicker = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri == null) {
            ai.notifyJs("state", JSONObject().put("status", ai.currentStatus()).put("message", "No model selected.").toString())
        } else {
            ai.installFromUri(uri)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, true)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        val root = FrameLayout(this)
        webView = WebView(this)
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)

        ai = LocalAi(this, webView) { kind, payload ->
            deliverAiEvent(kind, payload)
        }
        webView.addJavascriptInterface(ai, "AndroidAI")
        setupWebView()
        webView.loadUrl(webUrl)
    }

    fun launchModelPicker() {
        try {
            // A plain "*/*" is used deliberately: ".gguf" has no registered MIME type,
            // and mixing an invented one ("application/x-gguf") into the filter array
            // is what was confusing some OEM file pickers (Vivo/OriginOS in particular)
            // into not responding to a tap at all. The file is still fully verified
            // after selection (extension, GGUF magic bytes, SHA-256), so nothing is
            // lost by not pre-filtering here.
            modelPicker.launch(arrayOf("*/*"))
        } catch (_: Throwable) {
            deliverAiEvent("error", JSONObject().put("message", "No file picker app is available on this device.").toString())
        }
    }

    fun openModelDownloadPage() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(LocalAi.MODEL_URL)))
        } catch (_: Throwable) {
            deliverAiEvent("error", JSONObject().put("message", "Could not open the model download page.").toString())
        }
    }

    private fun deliverAiEvent(kind: String, payload: String) {
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            val js = "window.NativeAI && window.NativeAI._event(${JSONObject.quote(kind)},${JSONObject.quote(payload)})"
            webView.evaluateJavascript(js, null)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(false)
        val cookies = CookieManager.getInstance()
        cookies.setAcceptCookie(true)
        cookies.setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            mediaPlaybackRequiresUserGesture = true
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString MyBusinessAndroid/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return if (url.startsWith(webUrl) || url.startsWith("https://mybusinessapp-4734c.firebaseapp.com") || url.startsWith("https://accounts.google.com")) {
                    false
                } else {
                    try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (_: Throwable) {}
                    true
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                view.evaluateJavascript(
                    "window.__MYBUSINESS_ANDROID__=true;window.__MYBUSINESS_NATIVE_AI__=!!window.AndroidAI;",
                    null
                )
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                // Do not turn an optional Qwen failure into a main-app startup failure.
                if (request.isForMainFrame) {
                    ai.notifyWebError(error.description?.toString() ?: "Web page could not be loaded")
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean {
                val popup = WebView(this@MainActivity)
                popup.settings.javaScriptEnabled = true
                popup.settings.domStorageEnabled = true
                popup.settings.javaScriptCanOpenWindowsAutomatically = true
                popup.settings.setSupportMultipleWindows(true)
                popup.settings.userAgentString = popup.settings.userAgentString + " MyBusinessAndroid/1.0"
                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(popup, true)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                        // This popup exists only for the Google sign-in flow and is fully
                        // dismissible on its own. Never hand its navigation off to an
                        // external browser/app: Google's sign-in legitimately hops across
                        // several accounts.google.com sub-pages (and occasional extra
                        // verification steps on some accounts), and kicking any of those
                        // out here leaves the popup stuck on a blank page while the real
                        // page opens elsewhere.
                        return false
                    }
                }
                val dialog = Dialog(this@MainActivity)
                val box = FrameLayout(this@MainActivity)
                box.addView(popup, FrameLayout.LayoutParams(-1, -1))
                dialog.setContentView(box)
                dialog.setOnDismissListener { popup.destroy() }
                popup.tag = dialog
                dialog.show()
                dialog.window?.setLayout(-1, -1)
                (resultMsg.obj as? WebView.WebViewTransport)?.webView = popup
                resultMsg.sendToTarget()
                return true
            }
            override fun onCloseWindow(window: WebView) {
                (window.tag as? Dialog)?.dismiss()
                window.destroy()
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        ai.close()
        webView.stopLoading()
        webView.removeJavascriptInterface("AndroidAI")
        webView.destroy()
        super.onDestroy()
    }
}

class LocalAi(
    private val activity: MainActivity,
    private val webView: WebView,
    private val eventListener: (String, String) -> Unit
) {
    companion object {
        const val MODEL_NAME = "Qwen3-0.6B-Q4_0.gguf"
        const val MODEL_URL = "https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf?download=true"
        const val MODEL_SHA256 = "da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4"
        const val EXPECTED_BYTES = 429_000_000L
        const val MIN_REASONABLE_BYTES = 400_000_000L
        const val MAX_REASONABLE_BYTES = 500_000_000L
    }

    private var model: dev.ffmpegkit.llama.LlamaModel? = null
    private val busy = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)
    private val loading = AtomicBoolean(false)

    private val modelDir = File(activity.filesDir, "models")
    private val modelFile get() = File(modelDir, MODEL_NAME)
    private val tempFile get() = File(modelDir, "$MODEL_NAME.installing")
    private val markerFile get() = File(modelDir, "$MODEL_NAME.verified")

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
            .toString()
    }

    @JavascriptInterface
    fun openModelPicker() {
        activity.runOnUiThread { activity.launchModelPicker() }
    }

    @JavascriptInterface
    fun openModelDownloadPage() {
        activity.runOnUiThread { activity.openModelDownloadPage() }
    }

    @JavascriptInterface
    fun load() {
        loadModelIfNeeded()
    }

    @JavascriptInterface
    fun ask(requestId: String, prompt: String, systemPrompt: String) {
        loadModelIfNeeded {
            if (model == null) {
                notifyJs("result", JSONObject().put("id", requestId).put("ok", false).put("error", "Qwen model is not installed or could not be loaded.").toString())
                return@loadModelIfNeeded
            }
            if (!busy.compareAndSet(false, true)) {
                notifyJs("result", JSONObject().put("id", requestId).put("ok", false).put("error", "AI is still processing the previous request.").toString())
                return@loadModelIfNeeded
            }
            activity.lifecycleScope.launch(Dispatchers.IO) {
                try {
                    notifyJs("state", JSONObject().put("status", "thinking").toString())
                    val result = Llama.complete(
                        model!!,
                        prompt = prompt,
                        systemPrompt = systemPrompt,
                        maxTokens = 256
                    )
                    notifyJs("result", JSONObject().put("id", requestId).put("ok", true).put("text", result.text).put("tokensPerSecond", result.tokensPerSecond).toString())
                    notifyJs("state", JSONObject().put("status", "ready").toString())
                } catch (t: Throwable) {
                    notifyJs("result", JSONObject().put("id", requestId).put("ok", false).put("error", t.message ?: "Inference failed").toString())
                    notifyJs("state", JSONObject().put("status", "ready").toString())
                } finally {
                    busy.set(false)
                }
            }
        }
    }

    fun installFromUri(uri: Uri) {
        activity.lifecycleScope.launch(Dispatchers.IO) {
            try {
                modelDir.mkdirs()
                notifyJs("state", JSONObject().put("status", "checking").put("message", "Checking model...").toString())
                val name = queryDisplayName(uri)
                if (!name.lowercase().endsWith(".gguf")) throw IllegalArgumentException("Please select a .gguf model file.")
                val size = querySize(uri)
                if (size < MIN_REASONABLE_BYTES || size > MAX_REASONABLE_BYTES) throw IllegalArgumentException("The selected model size is not valid for Qwen3 0.6B Q4_0.")

                tempFile.delete()
                copyUriToTemp(uri, size)

                notifyJs("state", JSONObject().put("status", "verifying").put("message", "Verifying model...").toString())
                if (!hasGgufMagic(tempFile)) throw IllegalArgumentException("The selected file is not a valid GGUF file.")
                if (tempFile.length() != size) throw IllegalArgumentException("The model copy is incomplete.")
                val hash = sha256(tempFile)
                if (!hash.equals(MODEL_SHA256, true)) throw IllegalArgumentException("The selected Qwen model failed SHA-256 verification.")

                // Load the verified temporary file first. The currently working model stays untouched
                // until the new file has passed validation AND can actually be loaded by llama.
                notifyJs("state", JSONObject().put("status", "loading").put("message", "Loading Qwen AI...").toString())
                val newLoaded = Llama.loadModel(
                    tempFile.absolutePath,
                    LlamaConfig(
                        contextSize = 2048,
                        threads = max(2, Runtime.getRuntime().availableProcessors().coerceAtMost(6))
                    )
                )

                val backup = File(modelDir, "$MODEL_NAME.previous")
                backup.delete()
                val hadOld = modelFile.exists()
                if (hadOld && !modelFile.renameTo(backup)) {
                    runCatching { Llama.releaseModel(newLoaded) }
                    throw IllegalStateException("Could not safely replace the existing model.")
                }
                if (!tempFile.renameTo(modelFile)) {
                    if (hadOld) backup.renameTo(modelFile)
                    runCatching { Llama.releaseModel(newLoaded) }
                    throw IllegalStateException("Could not finalize the model file.")
                }

                val oldLoaded = model
                model = newLoaded
                runCatching { if (oldLoaded != null) Llama.releaseModel(oldLoaded) }
                markerFile.writeText("$MODEL_SHA256\n${modelFile.length()}\n")
                backup.delete()
                loading.set(false)

                notifyJs("state", JSONObject().put("status", "ready").put("message", "AI Ready").put("model", MODEL_NAME).toString())
            } catch (t: Throwable) {
                tempFile.delete()
                notifyJs("state", JSONObject().put("status", if (isInstalledAndVerified()) "installed" else "not_installed").put("message", t.message ?: "Model installation failed.").toString())
                notifyJs("error", JSONObject().put("message", t.message ?: "Model installation failed.").toString())
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
                    val percent = ((copied * 100) / total).toInt().coerceIn(0, 100)
                    if (percent != lastPercent) {
                        lastPercent = percent
                        notifyJs("install", JSONObject().put("percent", percent).put("bytes", copied).put("total", total).toString())
                    }
                }
                output.flush()
            }
        } ?: throw IllegalStateException("The selected file could not be read.")
    }

    private fun queryDisplayName(uri: Uri): String {
        var result = uri.lastPathSegment ?: "model.gguf"
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
        return modelFile.length() in MIN_REASONABLE_BYTES..MAX_REASONABLE_BYTES && marker.startsWith(MODEL_SHA256)
    }

    private fun hasGgufMagic(file: File): Boolean {
        file.inputStream().use { input ->
            val b = ByteArray(4)
            if (input.read(b) != 4) return false
            return b[0] == 'G'.code.toByte() && b[1] == 'G'.code.toByte() && b[2] == 'U'.code.toByte() && b[3] == 'F'.code.toByte()
        }
    }

    private fun loadModelIfNeeded(after: (() -> Unit)? = null) {
        if (model != null) { after?.invoke(); return }
        if (!isInstalledAndVerified()) {
            notifyJs("state", JSONObject().put("status", "not_installed").put("message", "Qwen model is not installed.").toString())
            after?.invoke()
            return
        }
        if (!loading.compareAndSet(false, true)) return
        activity.lifecycleScope.launch(Dispatchers.IO) {
            try {
                notifyJs("state", JSONObject().put("status", "loading").put("message", "Loading Qwen AI...").toString())
                val loaded = Llama.loadModel(
                    modelFile.absolutePath,
                    LlamaConfig(
                        contextSize = 2048,
                        threads = max(2, Runtime.getRuntime().availableProcessors().coerceAtMost(6))
                    )
                )
                model = loaded
                notifyJs("state", JSONObject().put("status", "ready").put("message", "AI Ready").put("model", MODEL_NAME).toString())
            } catch (t: Throwable) {
                notifyJs("state", JSONObject().put("status", "error").put("message", t.message ?: "Could not load Qwen.").toString())
            } finally {
                loading.set(false)
                withContext(Dispatchers.Main) { after?.invoke() }
            }
        }
    }

    fun notifyWebError(message: String) {
        notifyJs("webError", JSONObject().put("message", message).toString())
    }

    fun notifyJs(kind: String, payload: String) {
        if (closed.get()) return
        activity.runOnUiThread { if (!closed.get()) eventListener(kind, payload) }
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

    private fun releaseModel() {
        model?.let { runCatching { Llama.releaseModel(it) } }
        model = null
    }

    fun close() {
        closed.set(true)
        releaseModel()
    }
}