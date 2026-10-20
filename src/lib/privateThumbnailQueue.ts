/** Bound private thumbnail I/O without retaining assets or permission decisions. */
export function createPrivateThumbnailQueue(limit = 2) {
  let active = 0
  const pending: (() => void)[] = []
  const drain = () => { while (active < limit && pending.length) pending.shift()!() }
  return function enqueue<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.push(() => {
        if (signal.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return }
        active++
        // A UI cancellation must not release the slot while server validation is running.
        void Promise.resolve().then(work).then(value => {
          signal.throwIfAborted()
          resolve(value)
        }).catch(reject).finally(() => { active--; drain() })
      })
      drain()
    })
  }
}
