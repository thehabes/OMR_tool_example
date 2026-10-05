/**
 * Thin wrappers around the RERUM store (reads) and TinyNode (writes).
 * Every wrapper throws an ApiError when the response is not OK.
 */

import { TINY_URL, COLLECTION_URL, RERUM_ID_PREFIX, CREATOR } from "./config.js"

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" }

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

async function ensureOk(response, action) {
  if (response.ok) return
  const detail = await response.text().catch(() => "")
  throw new ApiError(`${action} failed (${response.status}).`, response.status, detail)
}

/**
 * Read the collection, bypassing the browser cache (RERUM sends max-age=86400).
 * @returns {Promise<object>} the collection ItemList
 */
export async function getCollection() {
  const response = await fetch(COLLECTION_URL, { cache: "no-store" })
  await ensureOk(response, "Loading the collection")
  return response.json()
}

/**
 * Create a new Example object in RERUM.
 * @returns {Promise<object>} the created object, including its @id
 */
export async function createExample() {
  const response = await fetch(`${TINY_URL}/create`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ type: "Example", timestamp: Date.now(), creator: CREATOR })
  })
  await ensureOk(response, "Creating an Example")
  return response.json()
}

/**
 * Overwrite the collection in place with a new item list.
 * Sends If-Overwritten-Version so a concurrent change results in a 409.
 * @param {object} collection the collection as last read
 * @param {object[]} items the new itemListElement
 * @returns {Promise<object>} the overwritten collection
 */
export async function overwriteCollection(collection, items) {
  const { __rerum, ...body } = collection
  const headers = { ...JSON_HEADERS }
  if (__rerum?.isOverwritten) headers["If-Overwritten-Version"] = __rerum.isOverwritten
  const response = await fetch(`${TINY_URL}/overwrite`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...body, itemListElement: items, numberOfItems: items.length })
  })
  await ensureOk(response, "Updating the collection")
  return response.json()
}

/**
 * Delete a RERUM object by its @id.
 * @param {string} id the full RERUM @id
 */
export async function deleteObject(id) {
  if (typeof id !== "string" || !id.startsWith(RERUM_ID_PREFIX)) {
    throw new ApiError("Refusing to delete an object that is not a RERUM id.", 400, id)
  }
  const response = await fetch(`${TINY_URL}/delete/${encodeURIComponent(id.slice(RERUM_ID_PREFIX.length))}`, {
    method: "DELETE"
  })
  await ensureOk(response, "Deleting the Example")
}
