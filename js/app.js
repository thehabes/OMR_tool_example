/**
 * UI for adding Example objects to the collection and removing (deleting) them.
 */

import { COLLECTION_URL, RERUM_ID_PREFIX, MAX_ITEMS } from "./config.js"
import { ApiError, getCollection, createExample, overwriteCollection, deleteObject } from "./api.js"

const addButton = document.getElementById("add-example")
const list = document.getElementById("example-list")
const count = document.getElementById("item-count")
const emptyMessage = document.getElementById("empty-message")
const status = document.getElementById("status")

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" })

let busy = false
let itemCount = 0

const itemsOf = collection => Array.isArray(collection?.itemListElement) ? collection.itemListElement : []

// The snapshot of a created object that is stored in the collection.
const toListItem = ({ "@id": id, type, timestamp, creator }) => ({ "@id": id, type, timestamp, creator })

const formatTimestamp = timestamp =>
  Number.isFinite(timestamp) ? dateFormat.format(new Date(timestamp)) : "Unknown time"

function announce(message, isError = false) {
  status.textContent = message
  status.classList.toggle("is-error", isError)
}

function setBusy(value) {
  busy = value
  addButton.disabled = busy || itemCount >= MAX_ITEMS
  for (const button of list.querySelectorAll("button")) button.disabled = busy
  list.setAttribute("aria-busy", String(busy))
}

function renderItem(item) {
  const id = item?.["@id"]
  const label = formatTimestamp(item?.timestamp)

  const li = document.createElement("li")
  li.className = "example-item"

  const details = document.createElement("div")
  details.className = "example-details"

  const time = document.createElement("time")
  time.className = "example-time"
  time.textContent = label
  if (Number.isFinite(item?.timestamp)) time.dateTime = new Date(item.timestamp).toISOString()

  const idText = typeof id === "string" ? id : "Missing @id"
  const idEl = idText.startsWith(RERUM_ID_PREFIX) ? document.createElement("a") : document.createElement("span")
  idEl.className = "example-id"
  idEl.textContent = idText.startsWith(RERUM_ID_PREFIX) ? idText.slice(RERUM_ID_PREFIX.length) : idText
  if (idEl instanceof HTMLAnchorElement) {
    idEl.href = idText
    idEl.target = "_blank"
    idEl.rel = "noreferrer"
  }

  details.append(time, idEl)

  const remove = document.createElement("button")
  remove.type = "button"
  remove.className = "button button-danger"
  remove.textContent = "Remove"
  remove.dataset.id = idText
  remove.setAttribute("aria-label", `Remove Example created ${label}`)

  li.append(details, remove)
  return li
}

function render(collection) {
  const items = itemsOf(collection)
  itemCount = items.length
  count.textContent = `${items.length} / ${MAX_ITEMS} items`
  emptyMessage.hidden = items.length > 0
  list.replaceChildren(...items.map(renderItem))
  setBusy(busy)
}

async function refresh() {
  render(await getCollection())
}

async function handleError(err, fallback) {
  console.error(err, err?.detail ?? "")
  await refresh().catch(refreshErr => console.error(refreshErr))
  const message = err instanceof ApiError && err.status === 409
    ? "The collection was changed elsewhere and has been reloaded. Please try again."
    : `${fallback} ${err.message}`
  announce(message, true)
}

async function addExample() {
  if (busy) return
  setBusy(true)
  announce("Adding an Example…")
  try {
    const collection = await getCollection()
    const items = itemsOf(collection)
    if (items.length >= MAX_ITEMS) {
      render(collection)
      announce(`The collection already holds the maximum of ${MAX_ITEMS} items.`, true)
      return
    }
    const created = await createExample()
    try {
      await overwriteCollection(collection, [...items, toListItem(created)])
    } catch (err) {
      // Don't leave an orphaned Example behind when it could not join the collection.
      await deleteObject(created["@id"]).catch(rollbackErr => console.error("Rollback failed", rollbackErr))
      throw err
    }
    await refresh()
    announce("Added a new Example.")
  } catch (err) {
    await handleError(err, "Could not add an Example.")
  } finally {
    setBusy(false)
  }
}

async function removeExample(id) {
  if (busy) return
  setBusy(true)
  announce("Removing the Example…")
  try {
    const collection = await getCollection()
    const items = itemsOf(collection)
    const remaining = items.filter(item => item?.["@id"] !== id)
    if (remaining.length === items.length) {
      render(collection)
      announce("That Example is no longer in the collection.", true)
      return
    }
    // Leave the collection first so a failed delete never leaves it pointing at a deleted object.
    await overwriteCollection(collection, remaining)
    try {
      await deleteObject(id)
    } catch (err) {
      console.error(err, err?.detail ?? "")
      await refresh()
      announce("Removed from the collection, but deleting the Example failed.", true)
      return
    }
    await refresh()
    announce("Removed and deleted the Example.")
  } catch (err) {
    await handleError(err, "Could not remove the Example.")
  } finally {
    setBusy(false)
  }
}

document.getElementById("collection-link").href = COLLECTION_URL
addButton.addEventListener("click", addExample)
list.addEventListener("click", event => {
  const button = event.target.closest("button[data-id]")
  if (button) removeExample(button.dataset.id)
})

setBusy(true)
try {
  await refresh()
} catch (err) {
  console.error(err, err?.detail ?? "")
  count.textContent = "Unavailable"
  announce("Could not load the collection. Reload the page to try again.", true)
} finally {
  setBusy(false)
}
