# Frontend coding conventions

Sources: [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html) and [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html). The following project conventions adapt those guides to a static frontend without a build step.

## General

- Use UTF-8 and two-space indentation.
- Use lowercase, hyphen-separated file names where several words are needed.
- Keep interface text, documentation, and comments in English.
- Explain important boundaries and design decisions in comments instead of repeating the code.
- Do not commit credentials, machine-specific logs, or dependency directories.

## JavaScript

- Use strict mode. Prefer `const`; use `let` only when reassignment is necessary. Do not use `var`.
- Use `lowerCamelCase` for variables and functions and `UpperCamelCase` for classes.
- Use single quotes and semicolons. Handle asynchronous network operations with `async` / `await`, explicit failures, and timeouts.
- Keep input handling, API communication, history rendering, and validation in focused functions.
- Use `textContent` and standard DOM methods for service-provided content. Do not interpolate dynamic data into `innerHTML`.
- Never use `eval`, the `Function` constructor, or arbitrary code execution. Scientific calculations and conversions belong to the backend.
- Preserve returned numbers as strings. Do not use JavaScript floating-point arithmetic for display values or number conversion.
- Validate external response structure before displaying it.
- Track input revisions independently for each mode so a late response cannot overwrite edited inputs or the result in another mode.
- Save operation type and parameters on the backend and use them when restoring history. Do not infer conversion inputs by parsing display labels.

## HTML and CSS

- Use semantic HTML, declare the document language, and associate form labels with inputs.
- Use native buttons and selects, accessible names on icon buttons, live regions for asynchronous feedback, and visible keyboard focus.
- Implement mode tabs with `tablist`, `tab`, and `tabpanel` semantics and arrow-key navigation.
- Organize CSS by component; use lowercase, hyphen-separated class names and shared variables for main colors.
- Support 320px and wider screens and honor the reduced-motion preference.
- Keep operational text readable and ensure interactive controls have useful click targets.
- Short CSS rules may share a line. Keep responsive overrides near the end of the stylesheet.

The Java preview server is a local development utility and follows the Java conventions documented in the backend project.
