import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

interface InstagramEmbedProps {
    url: string;
}

const buildEmbedUrl = (url: string) => {
    try {
        const normalized = url.replace(/\/embed.*$/, "").replace(/\/$/, "");
        return `${normalized}/embed/captioned/?omitscript=true`;
    } catch {
        return `${url}/embed/captioned/?omitscript=true`;
    }
};

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
    const embedUrl = useMemo(() => buildEmbedUrl(url), [url]);

    if (Platform.OS === "web") {
        return (
            <View style={styles.webContainer}>
                {React.createElement("iframe", {
                    src: embedUrl,
                    style: webIframeStyle,
                    allow:
                        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                    allowFullScreen: true,
                    loading: "lazy",
                    title: "Instagram post",
                })}
            </View>
        );
    }

    const WebView = require("react-native-webview").WebView;
    return (
        <View style={styles.nativeContainer}>
            <WebView source={{ uri: url }} style={styles.webview} />
        </View>
    );
};

const styles = StyleSheet.create({
    webContainer: {
        width: "100%",
        maxWidth: "100%",
        alignSelf: "stretch",
        overflow: "hidden",
        borderRadius: 18,
    },
    nativeContainer: { height: 700, width: "100%", overflow: "hidden" },
    webview: { flex: 1 },
});

const webIframeStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 820,
    border: "none",
    borderRadius: 18,
};

export default React.memo(InstagramEmbed);
