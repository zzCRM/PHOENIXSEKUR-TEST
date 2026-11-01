package com.phoenixsekur.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

public class MainActivity extends AppCompatActivity {
    static final Uri APP = Uri.parse("https://app.phoenixsekur.com/login");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        findViewById(R.id.open).setOnClickListener(v -> openSite());
        if (savedInstanceState == null) {
            openSite();
        }
    }

    private void openSite() {
        CustomTabColorSchemeParams colors = new CustomTabColorSchemeParams.Builder()
            .setToolbarColor(0xFF000000)
            .build();
        CustomTabsIntent tabs = new CustomTabsIntent.Builder()
            .setShowTitle(false)
            .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
            .setDefaultColorSchemeParams(colors)
            .build();
        tabs.intent.setPackage("com.android.chrome");
        try {
            tabs.launchUrl(this, APP);
        } catch (ActivityNotFoundException chromeMissing) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, APP));
            } catch (ActivityNotFoundException noBrowser) {
                // L'écran d'explication reste affiché.
            }
        }
    }
}
