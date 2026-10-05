# playground_example
An example tool that reads, creates, updates, and deletes its own data in the RERUM ecosystem.

It manages a single RERUM collection through [TinyNode](https://tinydev.rerum.io).
Add creates a new `Example` object and puts it in the collection.
Remove takes an `Example` out of the collection and deletes it.
The collection holds at most 10 items.

## Run locally

Serve the repository root with any static file server.
ES modules do not load from `file://`.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

Enable GitHub Pages for the repository and serve from the branch root.
There is no build step.

## Configuration

`js/config.js` holds the TinyNode URL, the collection URL, the item limit, and the `creator` value.
