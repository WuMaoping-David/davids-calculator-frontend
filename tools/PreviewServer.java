import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;

/** Local static preview only. API and all calculations belong to the separate backend. */
public final class PreviewServer {
  private static final Set<String> ASSETS = new HashSet<String>(Arrays.asList(
      "/index.html", "/styles.css", "/app.js", "/config.js", "/favicon.svg"));

  public static void main(String[] args) throws IOException {
    final Path root = Paths.get(args.length > 0 ? args[0] : ".").toAbsolutePath().normalize();
    int port = args.length > 1 ? Integer.parseInt(args[1]) : 5173;
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 32);
    server.createContext("/", exchange -> serve(exchange, root));
    server.setExecutor(Executors.newFixedThreadPool(4));
    Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(0)));
    server.start();
    System.out.println("Frontend: http://localhost:" + port);
  }

  private static void serve(HttpExchange exchange, Path root) throws IOException {
    try {
      String method = exchange.getRequestMethod();
      if (!"GET".equals(method) && !"HEAD".equals(method)) {
        exchange.getResponseHeaders().set("Allow", "GET, HEAD");
        exchange.sendResponseHeaders(405, -1);
        return;
      }
      String requested = exchange.getRequestURI().getPath();
      if ("/".equals(requested)) requested = "/index.html";
      Path file = root.resolve(requested.substring(1)).normalize();
      if (!ASSETS.contains(requested) || !file.startsWith(root) || !Files.isRegularFile(file)) {
        exchange.sendResponseHeaders(404, -1);
        return;
      }
      String type = requested.endsWith(".css") ? "text/css"
          : requested.endsWith(".js") ? "text/javascript"
          : requested.endsWith(".svg") ? "image/svg+xml" : "text/html";
      byte[] content = Files.readAllBytes(file);
      exchange.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
      exchange.getResponseHeaders().set("Cache-Control", "no-store");
      exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
      if ("HEAD".equals(method)) {
        exchange.getResponseHeaders().set("Content-Length", String.valueOf(content.length));
        exchange.sendResponseHeaders(200, -1);
      } else {
        exchange.sendResponseHeaders(200, content.length);
        exchange.getResponseBody().write(content);
      }
    } finally {
      exchange.close();
    }
  }
}
