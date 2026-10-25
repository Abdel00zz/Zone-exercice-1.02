package com.zoneexercice.app;

import android.content.Context;
import android.os.Bundle;
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
                    PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(
                        documentName != null && !documentName.trim().isEmpty() ? documentName : "Fiche_Exercices"
                    );
                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                    printManager.print(
                        documentName != null && !documentName.trim().isEmpty() ? documentName : "Fiche_Exercices",
                        printAdapter,
                        builder.build()
                    );
                }
            });
        }

        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }
    }
}
