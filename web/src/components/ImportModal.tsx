import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { toastError } from '../lib/forms';
import { Modal, Spinner, cn } from './ui';

type Row = Record<string, unknown>;
interface ImportResult {
  total: number;
  valid: number;
  created: number;
  updated: number;
  toCreate?: number;
  toUpdate?: number;
  errors: { row: number; field: string; message: string }[];
}

export interface ImportConfig {
  entity: 'customers' | 'products';
  title: string;
  columns: { name: string; required?: boolean; example: string }[];
  invalidate: string[];
  note?: string;
}

const MAX_ROWS = 2000;

/** Lê CSV (vírgula ou ponto e vírgula) ou XLSX no navegador e devolve objetos {cabeçalho: valor}. */
async function readFile(file: File): Promise<Row[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser'); // carregado só quando necessário
    const data = await readSheet(file);
    const [header = [], ...lines] = data;
    const keys = header.map((h) => String(h ?? '').trim());
    return lines
      .filter((l) => l.some((c) => c !== null && String(c).trim() !== ''))
      .map((l) => Object.fromEntries(keys.map((k, i) => [k, l[i] instanceof Date ? (l[i] as unknown as Date).toISOString().slice(0, 10) : l[i] ?? ''])));
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text();
    const parsed = Papa.parse<Row>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
    return parsed.data;
  }
  throw new Error('Formato não suportado. Use .csv ou .xlsx (Excel).');
}

function downloadTemplate(cfg: ImportConfig) {
  const header = cfg.columns.map((c) => c.name).join(';');
  const example = cfg.columns.map((c) => c.example).join(';');
  const blob = new Blob(['﻿' + header + '\n' + example + '\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `modelo-${cfg.entity === 'customers' ? 'clientes' : 'produtos'}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ImportModal({ open, onClose, config }: { open: boolean; onClose: () => void; config: ImportConfig }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => { setFile(null); setRows([]); setPreview(null); };
  const close = () => { reset(); onClose(); };

  const load = async (f: File) => {
    reset();
    setBusy(true);
    try {
      const data = await readFile(f);
      if (!data.length) throw new Error('A planilha não tem linhas preenchidas.');
      if (data.length > MAX_ROWS) throw new Error(`A planilha tem ${data.length} linhas; o máximo é ${MAX_ROWS} por vez.`);
      setFile(f.name);
      setRows(data);
      setPreview(await api.post<ImportResult>(`/import/${config.entity}`, { rows: data, dryRun: true }));
    } catch (e) {
      if (e instanceof Error && !('status' in e)) toast.error(e.message);
      else toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.post<ImportResult>(`/import/${config.entity}`, { rows, dryRun: false });
      toast.success(`${r.created} criado(s)${r.updated ? `, ${r.updated} atualizado(s)` : ''}.`);
      config.invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      close();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const willWrite = preview ? preview.valid : 0;

  return (
    <Modal open={open} onClose={close} title={config.title} size="lg"
      footer={<>
        <button className="btn-secondary" onClick={close}>Cancelar</button>
        <button className="btn-primary" disabled={!preview || !willWrite || busy} onClick={confirm}>
          {busy && preview ? <Spinner /> : <Upload className="h-4 w-4" />} Importar {willWrite ? `${willWrite} linha(s)` : ''}
        </button>
      </>}>
      <div className="space-y-4 text-sm">
        <div
          className={cn('flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition', dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-300')}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}>
          {busy && !preview ? <Spinner className="h-6 w-6 text-brand-600" /> : <FileSpreadsheet className="h-8 w-8 text-slate-400" />}
          <p className="mt-2 font-medium text-slate-800">{file ?? 'Arraste a planilha aqui'}</p>
          <p className="text-slate-500">CSV ou Excel (.xlsx), até {MAX_ROWS} linhas</p>
          <button className="btn-secondary mt-3" onClick={() => input.current?.click()} disabled={busy}>Escolher arquivo</button>
          <input ref={input} type="file" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
        </div>

        {!preview && (
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-800">Colunas reconhecidas</p>
              <button className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700" onClick={() => downloadTemplate(config)}><Download className="h-4 w-4" /> Baixar modelo</button>
            </div>
            <p className="mt-1 text-slate-600">{config.columns.map((c) => (c.required ? `${c.name}*` : c.name)).join(' · ')}</p>
            {config.note && <p className="mt-1 text-xs text-slate-500">{config.note}</p>}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-xl font-semibold num">{preview.total}</p><p className="text-xs text-slate-500">linhas lidas</p></div>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800"><p className="text-xl font-semibold num">{preview.valid}</p><p className="text-xs">{preview.toUpdate ? `${preview.toCreate} novos · ${preview.toUpdate} atualizações` : 'prontas para importar'}</p></div>
              <div className={cn('rounded-lg p-2', preview.errors.length ? 'bg-rose-50 text-rose-800' : 'bg-slate-50')}><p className="text-xl font-semibold num">{new Set(preview.errors.map((e) => e.row)).size}</p><p className="text-xs">com problema</p></div>
            </div>
            {preview.errors.length ? (
              <div>
                <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-800"><AlertTriangle className="h-4 w-4 text-amber-500" /> Estas linhas serão ignoradas:</p>
                <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {preview.errors.slice(0, 200).map((e, i) => (
                    <li key={i} className="flex gap-3 px-3 py-1.5"><span className="w-16 shrink-0 text-slate-500 num">Linha {e.row}</span><span className="text-slate-700">{e.field && <strong>{e.field}: </strong>}{e.message}</span></li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-slate-500">Corrija na planilha e importe de novo, ou siga só com as linhas válidas.</p>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Nenhum problema encontrado.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export const customerImport: ImportConfig = {
  entity: 'customers',
  title: 'Importar clientes',
  invalidate: ['customers', 'onboarding', 'dashboard'],
  columns: [
    { name: 'Nome', required: true, example: 'Maria Souza' },
    { name: 'E-mail', example: 'maria@email.com' },
    { name: 'Telefone', example: '(11) 98888-7777' },
    { name: 'CPF/CNPJ', example: '12345678909' },
    { name: 'Empresa', example: 'Padaria Central' },
    { name: 'Endereço', example: 'Rua das Flores, 100' },
    { name: 'Cidade', example: 'São Paulo' },
    { name: 'UF', example: 'SP' },
    { name: 'Observações', example: 'Prefere contato pelo WhatsApp' },
  ],
  note: 'Clientes com e-mail já cadastrado são ignorados. A ordem das colunas não importa.',
};

export const productImport: ImportConfig = {
  entity: 'products',
  title: 'Importar produtos',
  invalidate: ['products', 'onboarding', 'dashboard', 'billing'],
  columns: [
    { name: 'SKU', required: true, example: 'CAM-001' },
    { name: 'Nome', required: true, example: 'Camiseta básica' },
    { name: 'Categoria', example: 'Vestuário' },
    { name: 'Preço', required: true, example: '59,90' },
    { name: 'Custo', example: '25,00' },
    { name: 'Estoque', example: '30' },
    { name: 'Estoque mínimo', example: '5' },
    { name: 'Descrição', example: 'Algodão, várias cores' },
  ],
  note: 'SKU já cadastrado atualiza nome, preço e demais dados (o estoque só muda por movimentação). Valores aceitam "59,90" ou "R$ 1.234,56".',
};
