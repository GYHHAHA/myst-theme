import type { GenericParent } from 'myst-common';
import { SourceFileKind } from 'myst-common';
import React, { useContext, useEffect, useRef, useState } from 'react';
import type {
  Config,
  CoreOptions,
  IThebeCell,
  IThebeCellExecuteReturn,
  RepoProvider,
  ThebeCore,
  ThebeNotebook,
} from 'thebe-core';
import type { IThebeNotebookError, NotebookExecuteOptions } from 'thebe-react';
import { useNotebookBase, useThebeConfig, useThebeCore, ThebeServerProvider } from 'thebe-react';
import type { Root } from 'mdast';
import type { Thebe, ThebeServerOptions, ThebeLocalOptions } from 'myst-frontmatter';
import { useComputeOptions } from '@myst-theme/providers';

function getThebeOptions(): CoreOptions {
  const { thebe, binderUrl } = useComputeOptions();
  const {
    mathjaxUrl,
    mathjaxConfig,
    binder,
    server,
    kernelName,
    sessionName,
    disableSessionSaving,
    local,
  } = (thebe as Thebe | undefined) ?? {};
  const output: CoreOptions = { mathjaxUrl, mathjaxConfig };
  if (binder) {
    const useBinder = binder === true ? {} : binder;
    output.binderOptions = {
      binderUrl: useBinder.url ?? binderUrl,
      ref: useBinder.ref,
      repo: useBinder.repo,
      repoProvider: useBinder.provider as RepoProvider | undefined,
    };
  }
  const useServer = (local ?? server) as ThebeServerOptions | ThebeLocalOptions;
  if (server) {
    const splitUrl = useServer.url?.split('://');
    const wsUrl = splitUrl?.length === 2 ? `ws://${splitUrl[1]}` : undefined;
    output.serverSettings = {
      baseUrl: useServer.url,
      token: useServer.token,
      wsUrl,
      appendToken: true,
    };
  }
  output.kernelOptions = {
    kernelName: kernelName,
    name: kernelName,
    path: sessionName,
  };
  if (!disableSessionSaving) {
    output.savedSessionOptions = {
      enabled: true,
      maxAge: 38300,
      storagePrefix: 'thebe',
    };
  }
  return output;
}

export function ConfiguredThebeServerProvider({ children }: React.PropsWithChildren) {
  const thebe = getThebeOptions();
  return (
    <ThebeServerProvider connect={false} options={thebe}>
      {children}
    </ThebeServerProvider>
  );
}

export type PartialPage = {
  kind: SourceFileKind;
  file: string;
  sha256: string;
  slug: string;
  mdast: Root;
};

export function notebookFromMdast(
  core: ThebeCore,
  config: Config,
  mdast: GenericParent,
  idkMap: Record<string, string>,
) {
  const rendermime = undefined; // share rendermime beyond notebook scope?
  const notebook = new core.ThebeNotebook(mdast.key, config, rendermime);

  // no metadata included in mdast yet
  //Object.assign(notebook.metadata, ipynb.metadata);
  notebook.cells = (mdast.children as GenericParent[]).map((block: GenericParent) => {
    if (block.type !== 'block') console.warn(`Unexpected block type ${block.type}`);
    if (block.children.length == 2 && block.children[0].type === 'code') {
      const [codeCell, output] = block.children;

      // use the block.key to identify the cell but maintain a mapping
      // to allow code or output keys to look up cells and refs
      idkMap[block.key] = block.key;
      idkMap[codeCell.key] = block.key;
      idkMap[output.key] = block.key;
      return new core.ThebeCell(
        block.key,
        notebook.id,
        codeCell.value ?? '',
        config,
        block.data ?? {},
        notebook.rendermime,
      );
    } else {
      // assume content - concatenate it
      // TODO inject cell metadata
      const cell = new core.ThebeNonExecutableCell(
        block.key,
        notebook.id,
        block.children.reduce((acc, child) => acc + '\n' + (child.value ?? ''), ''),
        block.data ?? {},
        notebook.rendermime,
      );
      return cell;
    }
  });

  return notebook;
}

// registry[cellId]
type CellRefRegistry = Record<string, HTMLDivElement>;
type IdKeyMap = Record<string, string>;

interface NotebookContextType {
  kind: SourceFileKind;
  ready: boolean;
  attached: boolean;
  executing: boolean;
  executed: boolean;
  errors: IThebeNotebookError[] | null;
  executeAll: (
    options?: NotebookExecuteOptions | undefined,
  ) => Promise<(IThebeCellExecuteReturn | null)[]>;
  executeSome: (
    predicate: (cell: IThebeCell) => boolean,
    options?: NotebookExecuteOptions | undefined,
  ) => Promise<(IThebeCellExecuteReturn | null)[]>;
  notebook: ThebeNotebook | undefined;
  registry: CellRefRegistry;
  idkMap: IdKeyMap;
  register: (id: string) => (el: HTMLDivElement) => void;
  restart: () => Promise<void>;
  clear: () => void;
}

const NotebookContext = React.createContext<NotebookContextType | undefined>(undefined);

export function NotebookProvider({
  siteConfig,
  page,
  children,
}: React.PropsWithChildren<{ siteConfig: boolean; page: PartialPage }>) {
  // so at some point this gets the whole site config and can
  // be use to lookup notebooks and recover ThebeNotebooks that
  // can be used to execute notebook pages or blocks in articles
  const { core } = useThebeCore();
  const { config } = useThebeConfig();

  const {
    ready,
    attached,
    executing,
    executed,
    errors,
    executeAll,
    executeSome,
    clear,
    session,
    notebook,
    setNotebook,
  } = useNotebookBase();

  const registry = useRef<CellRefRegistry>({});
  const idkMap = useRef<IdKeyMap>({});

  useEffect(() => {
    if (!core || !config) return;
    registry.current = {};
    idkMap.current = {};
    if (page.kind === SourceFileKind.Notebook) {
      const nb = notebookFromMdast(core, config, page.mdast as GenericParent, idkMap.current);
      setNotebook(nb);
    } else {
      // TODO will need do article relative notebook loading as appropriate once that is supported
      setNotebook(undefined);
    }
  }, [core, config, page]);

  function register(id: string) {
    return (el: HTMLDivElement) => {
      if (el != null && registry.current[idkMap.current[id]] !== el) {
        if (!el.isConnected) {
          console.debug(`skipping ref for cell ${id} as host is not connected`);
        } else {
          console.debug(`new ref for cell ${id} registered`);
          registry.current[idkMap.current[id]] = el;
        }
      }
    };
  }

  return (
    <NotebookContext.Provider
      value={{
        kind: page.kind,
        ready,
        attached,
        executing,
        executed,
        errors,
        executeAll,
        executeSome,
        notebook,
        registry: registry.current,
        idkMap: idkMap.current,
        register,
        restart: () => session?.restart() ?? Promise.resolve(),
        clear,
      }}
    >
      {children}
    </NotebookContext.Provider>
  );
}

export function useHasNotebookProvider() {
  const notebookState = useContext(NotebookContext);
  return notebookState !== undefined;
}

export function useCellRefRegistry() {
  const notebookState = useContext(NotebookContext);
  if (notebookState === undefined) return undefined;
  return { register: notebookState.register };
}

export function useCellRef(id: string) {
  const notebookState = useContext(NotebookContext);
  if (notebookState === undefined) return undefined;

  const { registry, idkMap } = notebookState;
  const entry = Object.entries(notebookState.registry).find(([cellId]) => cellId === idkMap[id]);
  console.debug('useCellRef', { id, registry, idkMap, entry });
  return { el: entry?.[1] ?? null };
}

export function useMDASTNotebook() {
  const notebookState = useContext(NotebookContext);
  return notebookState;
}

export function useNotebookExecution() {
  const notebookState = useContext(NotebookContext);
  if (!notebookState) return undefined;

  const { ready, attached, executing, executed, errors, executeAll, notebook, clear } =
    notebookState;

  return { ready, attached, executing, executed, errors, execute: executeAll, notebook, clear };
}

export function useNotebookCellExecution(id: string) {
  // setup a cell only executing state
  const [executing, setExecuting] = useState(false);

  const notebookState = useContext(NotebookContext);
  if (!notebookState) return undefined;

  const {
    kind,
    ready,
    notebook,
    executing: notebookIsExecuting,
    executeSome,
    idkMap,
  } = notebookState;

  const cellId = idkMap[id];
  async function execute(options?: NotebookExecuteOptions) {
    setExecuting(true);
    const execReturn = await executeSome((cell) => cell.id === cellId, options);
    setExecuting(false);
    return execReturn;
  }
  const cell = notebook?.getCellById(cellId);
  return {
    kind,
    ready,
    cell,
    executing,
    notebookIsExecuting,
    execute,
    clear: () => cell?.clear(),
    notebook,
  };
}
