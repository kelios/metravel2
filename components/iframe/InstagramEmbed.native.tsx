import React from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

interface InstagramEmbedProps {
  url: string
}

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
  return (
    <View style={styles.nativeContainer}>
      <WebView source={{ uri: url }} style={styles.webview} />
    </View>
  )
}

const styles = StyleSheet.create({
  nativeContainer: { height: 700, width: '100%', overflow: 'hidden' },
  webview: { flex: 1 },
})

export default React.memo(InstagramEmbed)
