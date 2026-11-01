package com.zoneexercice.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new NativeAndroidBridge(this, webView), "AndroidNative");
        }
    }

    public static class NativeAndroidBridge {
        private final Context context;
        private final WebView webView;

        public NativeAndroidBridge(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
        }

        @JavascriptInterface
        public void printDocument(String documentName) {
            webView.post(() -> {
                PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                if (printManager != null) {
                    PrintDocumentAdapter delegate = webView.createPrintDocumentAdapter(
                        documentName != null && !documentName.trim().isEmpty() ? documentName : "Fiche_Exercices"
                    );
                    PrintDocumentAdapter printAdapter = new PrintDocumentAdapter() {
                        @Override public void onStart() { delegate.onStart(); }

                        @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                CancellationSignal signal, LayoutResultCallback callback, Bundle extras) {
                            delegate.onLayout(oldAttributes, newAttributes, signal, callback, extras);
                        }

                        @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                                CancellationSignal signal, WriteResultCallback callback) {
                            delegate.onWrite(pages, destination, signal, callback);
                        }

                        @Override public void onFinish() {
                            try { delegate.onFinish(); }
                            finally { finishPrint(); }
                        }
                    };
                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                    try {
                      printManager.print(
                        documentName != null && !documentName.trim().isEmpty() ? documentName : "Fiche_Exercices",
                        printAdapter,
                        builder.build()
                      );
                    } catch (RuntimeException error) {
                        finishPrint();
                    }
                } else {
                    finishPrint();
                }
            });
        }

        private void finishPrint() {
            webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new Event('worksheet-native-print-finished'))", null));
        }

        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }
    }
}
