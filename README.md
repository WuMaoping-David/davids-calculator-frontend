# David's calculator — Frontend

## Public deployment

For a Render Static Site, set the build command to `node build-render.mjs`, publish directory to `dist`, and environment variable `API_BASE_URL` to the backend HTTPS origin without `/api`. The build writes production configuration separately from the local `config.js`. Add the actual frontend HTTPS origin to the backend `CORS_ORIGINS`. See [PUBLIC_DEPLOYMENT.md](PUBLIC_DEPLOYMENT.md) for persistence and verification requirements.

## Project introduction

David's calculator is an English-language scientific web calculator with persistent calculation history. This repository contains the browser interface. A separately running Java backend evaluates expressions and stores history; the browser handles input, HTTP requests, and presentation only.

The current version supports arithmetic, parentheses, decimals, unary signs, powers, factorial, scientific functions, DEG/RAD, history reuse, single-record deletion, and **Clear all**. Inverse functions use `arcsin`, `arccos`, and `arctan`. Number-base and unit conversion have been removed. Older conversion records remain visible as archived entries but cannot be reused.

## Technology stack

| Component | Technology and responsibility |
|---|---|
| Interface | HTML5 and CSS, with responsive layout and accessible form controls |
| Browser logic | Plain JavaScript, Fetch API, and JSON; no client-side expression evaluator |
| Local static server | Java JDK `HttpServer`, implemented in `tools/PreviewServer.java` |
| Calculation service | Separate Java HTTP API, normally on port 8080 |
| Persistence | Local H2 or cloud PostgreSQL, managed exclusively by the backend |

Local preview requires no npm packages, Node.js runtime, or frontend framework. The optional Render production build uses Node.js to copy assets and generate configuration, without npm dependencies. The Java preview server only serves static assets; it performs no calculations.

## Runtime environment

- A modern browser supporting Fetch, AbortController, optional chaining, and CSS Grid, such as a current Chrome, Edge, or Firefox release.
- For the supplied local startup script: Windows with PowerShell 5.1 or newer and a full **JDK 8 or newer** on `PATH`. Both `java` and `javac` are required; a JRE alone is insufficient. The project has been exercised with JDK 8.
- Port **5173** available for the frontend, unless another port is selected.
- A running compatible backend. For the default setup, it must be reachable at `http://localhost:8080`.

The HTML, CSS, and JavaScript can also be served by another static HTTP server. PowerShell and the JDK are requirements of the included preview workflow, not of a visitor's browser.

## Installation method

1. Obtain this repository using Git or download and extract its source ZIP. Open PowerShell in the directory containing `index.html`, `app.js`, and `serve.ps1`. In the combined workspace, this is `calculator-frontend`.
2. Install a full JDK if needed and verify that both commands are available:

```powershell
java -version
javac -version
```

3. Obtain and start the separate backend using its README. It requires its own dependencies and initializes the database automatically.
4. Check `config.js` as described below. No dependency installation or `npm install` is needed for the frontend.

When publishing this directory as an independent repository, keep these files at the repository root rather than placing them inside another `calculator-frontend` directory.

## Startup method

From this repository's root:

```powershell
.\serve.ps1
```

The script compiles the preview server into `target/preview`, then serves the interface at **http://localhost:5173**. Keep the terminal open and press **Ctrl+C** to stop the frontend. Stopping this process does not stop the separately running backend or remove history.

Open the HTTP address in a browser. Do not double-click `index.html` or use a `file:` URL: the interface expects an HTTP origin permitted by the backend's CORS configuration.

The combined workspace additionally provides `start.ps1` and `stop.ps1` at its top level. Those scripts are optional convenience tools and are not required in this independent frontend repository.

## Configuration instructions

Set the backend origin in `config.js`:

```javascript
window.CALCULATOR_CONFIG = Object.freeze({
  apiBaseUrl: 'http://localhost:8080',
});
```

Use a URL reachable from the visitor's browser. Do not append `/api`; the frontend adds API paths itself. After changing this file, reload the page. Do not put database credentials or secrets in frontend files.

To change the local frontend port:

```powershell
.\serve.ps1 -Port 5174
```

Then open `http://localhost:5174` and add that exact origin to the backend's `CORS_ORIGINS`. A port change changes the origin. The included preview server binds only to `127.0.0.1` and is intended for local use.

## Database initialization method

**No database installation, SQL script, or database credentials are needed in this repository.** Start the backend first. On its first startup it creates the database directory, H2 database, and `calculation_history` table automatically.

With the backend's default configuration, its database file is `data/calculator.mv.db`, relative to the backend repository. Reusing that file preserves history across refreshes and restarts. The browser does not store the authoritative history in LocalStorage and never opens the database directly.

## Frontend/backend connection method

The two applications run as separate processes, normally on separate ports:

```text
Browser at http://localhost:5173
  -> HTTP JSON requests to http://localhost:8080/api/...
  -> Java expression service and H2 database
  <- saved result, history data, or an English error
```

For the default setup:

1. Start the backend on port 8080.
2. Keep `apiBaseUrl` set to `http://localhost:8080`.
3. Keep the backend's default allowed origins: `http://localhost:5173,http://127.0.0.1:5173`.
4. Start the frontend and enter `arcsin(0.5)` in DEG mode. The result should be `30`, with a new history entry.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Check service and database availability |
| POST | `/api/calculate` | Submit `expression` and `angleMode` (`deg` or `rad`) |
| GET | `/api/history` | Retrieve records, newest first |
| DELETE | `/api/history/{id}` | Permanently delete one saved record |
| DELETE | `/api/history` | Permanently clear all saved records |

A calculation succeeds with HTTP 201 and `{"success":true,"data":record}`. History uses HTTP 200 and an array in `data`. A record includes `id`, `expression`, string `result`, UTC `createdAt`, `type`, and `parameters`. Results stay strings so the browser does not round them through JavaScript numeric conversion. Errors use `{"success":false,"message":"English explanation","code":"ERROR_CODE"}`.

## Usage and verification

- Enter an expression or use the keypad. Press **Enter** or `=` to calculate, and **Esc** to clear the input.
- Use explicit multiplication: `2*pi` and `2*(3+4)`. Implicit multiplication is unsupported.
- Supported functions: `sin`, `cos`, `tan`, `arcsin`, `arccos`, `arctan`, `sqrt`, `abs`, `ln`, `log`, and `exp`. Use `^` for powers, `!` for factorial, and `pi` or `e` for constants.
- DEG/RAD controls trigonometric inputs and inverse-trigonometric outputs. `log` is base 10; `ln` is natural logarithm.
- Select a calculation in history to restore its expression and angle mode without automatically submitting it.
- **Clear all** immediately deletes all saved history in the backend database. It is disabled for empty history and while a local calculation or deletion is pending. Single-record deletion remains available.
- Delayed responses do not overwrite results for edited input. Local requests have a ten-second timeout. Render builds configure a 120-second timeout to allow free services to wake after idle periods; `requestTimeoutMs` can be configured between 1000 and 120000 milliseconds. If a request times out, refresh history before retrying to check whether the server already saved it.

Suggested acceptance checks:

| Check | Expected outcome |
|---|---|
| `(1+2)*3` | `9` |
| `0.1+0.2` | `0.3` |
| `arcsin(0.5)` in DEG | `30` |
| `sin(pi/2)` in RAD | Approximately `1` |
| `1/0` | English error; no successful record added |
| Refresh the browser | Saved history remains |
| Delete a disposable test entry | Other entries remain |
| Clear disposable test history, then refresh | History stays empty |

## Troubleshooting and deployment notes

| Problem | What to check |
|---|---|
| `java` or `javac` is not recognized | Install a full JDK, add its `bin` directory to `PATH`, and reopen the terminal |
| PowerShell refuses to run a script | Inspect the downloaded file and follow your machine's approved script policy; an organization-managed policy may require administrator help |
| Port 5173 is occupied | Stop the conflicting preview or choose `-Port 5174` and update backend CORS |
| The page reports Offline | Check the backend process, `/api/health`, and `config.js` |
| Health opens, but browser requests fail | Match CORS to the frontend's exact scheme, hostname, and port; `localhost` and `127.0.0.1` are different origins |
| An HTTPS page cannot reach the API | Use an HTTPS backend or a correctly configured same-origin reverse proxy |
| History is unavailable | Inspect backend logs and its database path and write permissions |

For public hosting, serve the static assets from a suitable web server and configure the actual publicly reachable backend URL. `localhost` in a public visitor's browser refers to that visitor's computer. Source publication on GitHub does not run the Java backend. Verify the actual public URLs after deployment; a successful local preview does not establish cloud availability.

There are no user accounts: history is shared by everyone accessing the same backend. CORS controls browser origins; it is not user authentication.

## Repository files and coding conventions

```text
index.html                 Calculator form and history panel
styles.css                 Layout, styling, and focus states
app.js                     Input, HTTP requests, and history interactions
config.js                  Backend origin
favicon.svg                Application icon
serve.ps1                  Local preview startup
tools/PreviewServer.java   Static preview server
codestyle.md               Frontend coding conventions
README.md                  Installation and operating guide
```

Follow [the frontend coding conventions](codestyle.md). Publish source files, README, and codestyle together. Generated `target/` output is not needed to install from source.
