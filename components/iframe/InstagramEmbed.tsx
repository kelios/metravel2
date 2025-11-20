import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

interface InstagramEmbedProps {
    url: string;
}

const buildEmbedUrl = (url: string) => {
    try {
        const normalized = url.replace(/\/embed.*$/, "").replace(/\/$/, "");
        // Используем параметры для минимизации интерфейса
        // hidecaption=1 - скрывает подпись (если поддерживается)
        return `${normalized}/embed/?omitscript=true&hidecaption=1`;
    } catch {
        return `${url}/embed/?omitscript=true&hidecaption=1`;
    }
};

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
    const embedUrl = useMemo(() => buildEmbedUrl(url), [url]);

    if (Platform.OS === "web") {
        return React.createElement("div", {
            className: "instagram-wrapper",
        }, React.createElement("iframe", {
            src: embedUrl,
            className: "instagram-embed",
            allow:
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
            allowFullScreen: true,
            loading: "lazy",
            title: "Instagram post",
        }));
    }

    const WebView = require("react-native-webview").WebView;
    return (
        <View style={styles.nativeContainer}>
            <WebView source={{ uri: url }} style={styles.webview} />
        </View>
    );
};

const styles = StyleSheet.create({
    nativeContainer: { height: 700, width: "100%", overflow: "hidden" },
    webview: { flex: 1 },
});

export default React.memo(InstagramEmbed);
