package com.mybusiness.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * MyBusiness standalone Android shell.
 *
 * The web app is remote-first so normal HTML/CSS/JS updates can be deployed
 * to Vercel without publishing a new APK. The PWA service worker/WebView
 * storage provide the offline copy after the app has been opened online.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "https://mybusiness-green.vercel.app/";
    private WebView webView;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean showingOfflineFallback = false;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(15, 118, 110));
        getWindow().setNavigationBarColor(Color.rgb(7, 47, 46));

        webView = new WebView(this);
        setContentView(webView);
        configureWebView();
        registerNetworkCallback();
        loadApp();
    }

    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " MyBusinessAndroid/2.1");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        if (android.os.Build.VERSION.SDK_INT >= 24) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return null;
                }
            });
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.equals("mybusiness-green.vercel.app")
                        || host.endsWith("firebaseapp.com")
                        || host.endsWith("gstatic.com"))) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {}
                return true;
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                showingOfflineFallback = false;
                view.setBackgroundColor(Color.WHITE);
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !isOnline()) {
                    showOfflineFallback();
                }
            }
        });
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    }

    private void loadApp() {
        showingOfflineFallback = false;
        webView.loadUrl(START_URL);
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void showOfflineFallback() {
        if (showingOfflineFallback) return;
        showingOfflineFallback = true;
        webView.loadDataWithBaseURL(
                START_URL,
                "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                        + "<style>body{font-family:system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6fbfa;color:#173b39;text-align:center;padding:24px}div{max-width:420px}h1{font-size:28px}p{line-height:1.6}button{border:0;border-radius:14px;padding:13px 20px;background:#0f766e;color:#fff;font-weight:700;font-size:16px}</style>"
                        + "</head><body><div><h1>MyBusiness</h1><p>You're offline. MyBusiness will use its cached app when available. If this is the first launch, connect to the internet once to download the app.</p><button onclick='location.reload()'>Try again</button></div></body></html>",
                "text/html", "UTF-8", null);
    }

    private void registerNetworkCallback() {
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null || android.os.Build.VERSION.SDK_INT < 24) return;

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) {
                runOnUiThread(() -> {
                    if (showingOfflineFallback) loadApp();
                });
            }
        };
        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception ignored) {}
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (connectivityManager != null && networkCallback != null && android.os.Build.VERSION.SDK_INT >= 24) {
            try { connectivityManager.unregisterNetworkCallback(networkCallback); } catch (Exception ignored) {}
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
