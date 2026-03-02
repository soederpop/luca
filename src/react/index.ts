import { createContext, useContext, useRef, useState, useEffect, useCallback, useMemo, createElement } from 'react'
import type { ReactNode } from 'react'
import type { Container, AvailableFeatures } from '../container'
import type { Helper } from '../helper'
import type { StateChangeType } from '../state'

// ── Context & Provider ──────────────────────────────────────────────

const ContainerContext = createContext<Container | null>(null)

function ContainerProvider({ container, children }: { container: Container; children: ReactNode }) {
  return createElement(ContainerContext.Provider, { value: container }, children)
}

function useContainer<T extends Container = Container>(): T {
  const container = useContext(ContainerContext)
  if (!container) {
    throw new Error('useContainer must be used within a <ContainerProvider>')
  }
  return container as T
}

// ── State Hooks ─────────────────────────────────────────────────────

type HasState = { state: { current: any; version: number; observe: (cb: (changeType: StateChangeType, key: any, value?: any) => void) => () => void } }

function useContainerState<T extends object = any>(target?: HasState): T {
  const container = useContext(ContainerContext)
  const resolved = target ?? container
  if (!resolved) {
    throw new Error('useContainerState requires a target or a ContainerProvider')
  }
  const [snapshot, setSnapshot] = useState<T>(() => ({ ...resolved.state.current }))

  useEffect(() => {
    setSnapshot({ ...resolved.state.current })
    const unsub = resolved.state.observe(() => {
      setSnapshot({ ...resolved.state.current })
    })
    return unsub
  }, [resolved])

  return snapshot
}

function useStateValue<V = any>(target: HasState, key: string): V | undefined {
  const [value, setValue] = useState<V | undefined>(() => target.state.current[key])

  useEffect(() => {
    setValue(target.state.current[key])
    const unsub = target.state.observe((_changeType: StateChangeType, changedKey: any, newValue?: any) => {
      if (changedKey === key) {
        setValue(newValue as V)
      }
    })
    return unsub
  }, [target, key])

  return value
}

function useStateVersion(target?: HasState): number {
  const container = useContext(ContainerContext)
  const resolved = target ?? container
  if (!resolved) {
    throw new Error('useStateVersion requires a target or a ContainerProvider')
  }
  const [version, setVersion] = useState(() => resolved.state.version)

  useEffect(() => {
    setVersion(resolved.state.version)
    const unsub = resolved.state.observe(() => {
      setVersion(resolved.state.version)
    })
    return unsub
  }, [resolved])

  return version
}

// ── Event Hooks ─────────────────────────────────────────────────────

type HasEvents = { on: (event: string, listener: (...args: any[]) => void) => any; off: (event: string, listener?: (...args: any[]) => void) => any }

function useEvent(target: HasEvents, event: string, handler: (...args: any[]) => void): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const listener = (...args: any[]) => handlerRef.current(...args)
    target.on(event, listener)
    return () => { target.off(event, listener) }
  }, [target, event])
}

function useWaitFor<T = any>(target: HasEvents & { waitFor: (event: string) => Promise<any> }, event: string): { data: T | undefined; pending: boolean; error: Error | undefined } {
  const [data, setData] = useState<T | undefined>(undefined)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<Error | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setPending(true)
    setData(undefined)
    setError(undefined)

    target.waitFor(event).then(
      (result) => {
        if (!cancelled) {
          setData(result as T)
          setPending(false)
        }
      },
      (err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setPending(false)
        }
      }
    )

    return () => { cancelled = true }
  }, [target, event])

  return { data, pending, error }
}

// ── Feature Hook ────────────────────────────────────────────────────

function useFeature<K extends keyof AvailableFeatures>(
  name: K,
  options?: ConstructorParameters<AvailableFeatures[K]>[0]
): InstanceType<AvailableFeatures[K]> {
  const container = useContainer()
  return useMemo(
    () => container.feature(name, options),
    [container, name]
  )
}

// ── Helper State Hook ───────────────────────────────────────────────

function useHelperState<T extends object = any>(helper: Helper): [T, (value: any) => void] {
  const [snapshot, setSnapshot] = useState<T>(() => ({ ...helper.state.current } as T))

  useEffect(() => {
    setSnapshot({ ...helper.state.current } as T)
    const unsub = helper.state.observe(() => {
      setSnapshot({ ...helper.state.current } as T)
    })
    return unsub
  }, [helper])

  const setState = useCallback(
    (value: any) => helper.setState(value),
    [helper]
  )

  return [snapshot, setState]
}

// ── Exports ─────────────────────────────────────────────────────────

export {
  ContainerContext,
  ContainerProvider,
  useContainer,
  useContainerState,
  useStateValue,
  useStateVersion,
  useEvent,
  useWaitFor,
  useFeature,
  useHelperState,
}
