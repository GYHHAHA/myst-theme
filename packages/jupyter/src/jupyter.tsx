import React, { useEffect, useRef, useState } from 'react';
import type { IOutput } from '@jupyterlab/nbformat';
import { useFetchAnyTruncatedContent } from './hooks';
import type { MinifiedOutput } from 'nbtx';
import { convertToIOutputs } from 'nbtx';
import { fetchAndEncodeOutputImages } from './convertImages';
import type { ThebeCore } from 'thebe-core';
import { useThebeCore } from 'thebe-react';
import { useCellRef, useCellRefRegistry, useNotebookCellExecution } from './providers';
import { SourceFileKind } from 'myst-common';
import { useXRefState } from '@myst-theme/providers';

function ActiveOutputRenderer({ id, data }: { id: string; data: IOutput[] }) {
  const ref = useCellRef(id);
  const exec = useNotebookCellExecution(id);

  useEffect(() => {
    if (!ref?.el || !exec?.cell) return;
    console.debug(`Attaching cell ${exec.cell.id} to DOM at:`, {
      el: ref.el,
      connected: ref.el.isConnected,
      data,
    });
    exec.cell.attachToDOM(ref.el);
    exec.cell.render(data);
  }, [ref?.el, exec?.cell]);

  return null;
}

function PassiveOutputRenderer({
  id,
  data,
  core,
  kind,
}: {
  id: string;
  data: IOutput[];
  core: ThebeCore;
  kind: SourceFileKind;
}) {
  const [cell] = useState(new core.PassiveCellRenderer(id, undefined, undefined));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cell.render(data, kind === SourceFileKind.Article);
  }, [data, cell]);
  useEffect(() => {
    if (!ref.current) return;
    cell.attachToDOM(ref.current, true);
  }, [ref]);
  return <div ref={ref} data-thebe-passive-ref="true" />;
}

const MemoPassiveOutputRenderer = React.memo(PassiveOutputRenderer);

export const JupyterOutputs = ({ id, outputs }: { id: string; outputs: MinifiedOutput[] }) => {
  const { core, load } = useThebeCore();
  const { inCrossRef } = useXRefState();
  const { data, error } = useFetchAnyTruncatedContent(outputs);
  const [loaded, setLoaded] = useState(false);
  const [fullOutputs, setFullOutputs] = useState<IOutput[] | null>(null);
  const registry = useCellRefRegistry();
  const exec = useNotebookCellExecution(id);

  useEffect(() => {
    if (core) return;
    load();
  }, [core, load]);

  useEffect(() => {
    if (!data || loaded || fullOutputs != null) return;
    setLoaded(true);
    fetchAndEncodeOutputImages(data).then((out) => {
      const compactOutputs = convertToIOutputs(out, {});
      setFullOutputs(compactOutputs);
    });
  }, [id, data, fullOutputs]);

  if (error) {
    return <div className="text-red-500">Error rendering output: {error.message}</div>;
  }

  if (!inCrossRef && registry && exec?.cell) {
    return (
      <div ref={registry?.register(id)} data-thebe-active-ref="true">
        {!fullOutputs && <div className="p-2.5">Loading...</div>}
        {fullOutputs && <ActiveOutputRenderer id={id} data={fullOutputs} />}
      </div>
    );
  }

  return (
    <>
      {!fullOutputs && <div className="p-2.5">Loading...</div>}
      {fullOutputs && core && (
        <MemoPassiveOutputRenderer
          id={id}
          data={fullOutputs}
          core={core}
          kind={exec?.kind ?? SourceFileKind.Notebook}
        ></MemoPassiveOutputRenderer>
      )}
    </>
  );
};
