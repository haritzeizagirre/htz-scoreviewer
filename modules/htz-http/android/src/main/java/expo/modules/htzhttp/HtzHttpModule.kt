package expo.modules.htzhttp

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.HttpURLConnection
import java.net.URL

/**
 * GET de texto usando HttpURLConnection:
 *  - Fuerza HTTP/1.1 (OkHttp/h2 puede exponer respuestas 103 Early Hints como finales).
 *  - HttpURLConnection ignora las respuestas informacionales 1xx y devuelve la final.
 */
class HtzHttpModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HtzHttp")

    AsyncFunction("getText") { url: String ->
      val connection = (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 15000
        readTimeout = 25000
        instanceFollowRedirects = true
        setRequestProperty(
          "User-Agent",
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        )
        setRequestProperty(
          "Accept",
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        )
        setRequestProperty("Accept-Language", "en-US,en;q=0.9,es;q=0.8")
        setRequestProperty("Cache-Control", "no-cache")
      }
      try {
        val code = connection.responseCode
        if (code < 200 || code >= 300) {
          throw Exception("HTTP $code al conectar con Gezzly")
        }
        connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
      } finally {
        connection.disconnect()
      }
    }
  }
}
