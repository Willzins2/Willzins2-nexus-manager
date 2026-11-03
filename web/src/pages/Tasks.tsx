import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, User as UserIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { PriorityBadge } from '../components/badges';
import { ConfirmDialog, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Select, Spinner, Textarea, cn } from '../components/ui';
import { date, taskStatusLabel } from '../lib/format';
import { errorMessage, handleFormError, toastError } from '../lib/forms';
import type { Customer, Paged, Task, TaskStatus } from '../lib/types';

const columns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
const colTone: Record<TaskStatus, string> = { TODO: 'bg-slate-400', IN_PROGRESS: 'bg-brand-500', DONE: 'bg-emerald-500' };

const schema = z.object({
  title: z.string().trim().min(2, 'Informe o título'),
  description: z.string(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  dueDate: z.string(),
  assigneeId: z.string(),
  customerId: z.string(),
});
type Form = z.infer<typeof schema>;

function TaskForm({ task, initialStatus, onClose, onDelete }: { task: Task | null; initialStatus: TaskStatus; onClose: () => void; onDelete: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: users = [] } = useQuery({ queryKey: ['users', 'options'], queryFn: () => api.get<{ id: string; name: string }[]>('/users/options') });
  const { data: customers } = useQuery({ queryKey: ['customers', 'all-options'], queryFn: () => api.get<Paged<Customer>>('/customers', { pageSize: 100 }) });
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    reset(task
      ? { title: task.title, description: task.description ?? '', status: task.status, priority: task.priority, dueDate: task.dueDate?.slice(0, 10) ?? '', assigneeId: task.assignee?.id ?? '', customerId: task.customer?.id ?? '' }
      : { title: '', description: '', status: initialStatus, priority: 'MEDIUM', dueDate: '', assigneeId: user?.id ?? '', customerId: '' });
  }, [task, initialStatus, reset, user]);

  const onSubmit = async (data: Form) => {
    try {
      if (task) await api.put(`/tasks/${task.id}`, data);
      else await api.post('/tasks', data);
      toast.success(task ? 'Tarefa atualizada' : 'Tarefa criada');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (e) {
      handleFormError(e, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Título *" error={errors.title?.message} className="sm:col-span-2"><Input invalid={!!errors.title} {...register('title')} autoFocus /></Field>
      <Field label="Descrição" className="sm:col-span-2"><Textarea {...register('description')} /></Field>
      <Field label="Status"><Select {...register('status')}>{columns.map((c) => <option key={c} value={c}>{taskStatusLabel[c]}</option>)}</Select></Field>
      <Field label="Prioridade"><Select {...register('priority')}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option></Select></Field>
      <Field label="Responsável" error={errors.assigneeId?.message}><Select {...register('assigneeId')}><option value="">Sem responsável</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
      <Field label="Prazo" error={errors.dueDate?.message}><Input type="date" {...register('dueDate')} /></Field>
      <Field label="Cliente relacionado" className="sm:col-span-2"><Select {...register('customerId')}><option value="">Nenhum</option>{customers?.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        {task && <button type="button" className="btn-ghost text-rose-600" onClick={onDelete}><Trash2 className="h-4 w-4" /> Excluir</button>}
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />} Salvar</button>
        </div>
      </div>
    </form>
  );
}

export default function Tasks() {
  const qc = useQueryClient();
  const [mine, setMine] = useState(false);
  const [editing, setEditing] = useState<{ task: Task | null; status: TaskStatus } | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const key = ['tasks', { mine }];
  const { data: tasks, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api.get<Task[]>('/tasks', { mine: mine ? 'true' : undefined }) });

  // Atualização otimista: o cartão muda de coluna na hora e volta se a API falhar.
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api.patch(`/tasks/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (ts) => ts?.map((t) => (t.id === id ? { ...t, status } : t)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(key, ctx?.prev); toastError(e); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => { toast.success('Tarefa excluída'); qc.invalidateQueries({ queryKey: ['tasks'] }); setDeleting(null); setEditing(null); },
    onError: (e) => toastError(e),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Tarefas" subtitle="Organize as atividades da equipe. Arraste os cartões entre as colunas."
        actions={<>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Só as minhas</label>
          <button className="btn-primary" onClick={() => setEditing({ task: null, status: 'TODO' })}><Plus className="h-4 w-4" /> Nova tarefa</button>
        </>} />

      {isLoading ? <PageLoader /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {columns.map((col, ci) => {
            const items = tasks?.filter((t) => t.status === col) ?? [];
            return (
              <section key={col} className={cn('flex min-h-[200px] flex-col rounded-xl border border-slate-200 bg-slate-100/60 p-3 transition', dragging && 'border-dashed border-brand-300')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragging) { const t = tasks?.find((x) => x.id === dragging); if (t && t.status !== col) move.mutate({ id: dragging, status: col }); } setDragging(null); }}>
                <header className="mb-3 flex items-center justify-between px-1">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className={cn('h-2 w-2 rounded-full', colTone[col])} />{taskStatusLabel[col]} <span className="font-normal text-slate-400">{items.length}</span></h2>
                  <button className="btn-icon btn-ghost p-1" onClick={() => setEditing({ task: null, status: col })} aria-label={`Nova tarefa em ${taskStatusLabel[col]}`}><Plus className="h-4 w-4" /></button>
                </header>
                <ul className="space-y-2">
                  {items.map((t) => {
                    const overdue = t.dueDate && t.status !== 'DONE' && t.dueDate.slice(0, 10) < today;
                    return (
                      <li key={t.id} draggable onDragStart={() => setDragging(t.id)} onDragEnd={() => setDragging(null)}
                        className={cn('group cursor-grab rounded-lg border border-slate-200 bg-surface p-3 shadow-card transition hover:border-brand-200 active:cursor-grabbing', dragging === t.id && 'opacity-50')}>
                        <button className="block w-full text-left" onClick={() => setEditing({ task: t, status: t.status })}>
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-sm font-medium text-slate-900', t.status === 'DONE' && 'text-slate-500 line-through')}>{t.title}</p>
                            <PriorityBadge priority={t.priority} />
                          </div>
                          {t.customer && <p className="mt-1 text-xs text-slate-500">Cliente: {t.customer.name}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            {t.dueDate && <span className={cn('flex items-center gap-1', overdue && 'font-medium text-rose-600')}><CalendarDays className="h-3.5 w-3.5" />{date(t.dueDate)}{overdue && ' · atrasada'}</span>}
                            {t.assignee && <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" />{t.assignee.name.split(' ')[0]}</span>}
                          </div>
                        </button>
                        {/* Alternativa ao arrastar (toque/teclado) */}
                        <div className="mt-2 flex justify-end gap-1 md:opacity-0 md:transition md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          {ci > 0 && <button className="btn-icon btn-ghost p-1" onClick={() => move.mutate({ id: t.id, status: columns[ci - 1] })} aria-label={`Mover para ${taskStatusLabel[columns[ci - 1]]}`}><ChevronLeft className="h-4 w-4" /></button>}
                          {ci < 2 && <button className="btn-icon btn-ghost p-1" onClick={() => move.mutate({ id: t.id, status: columns[ci + 1] })} aria-label={`Mover para ${taskStatusLabel[columns[ci + 1]]}`}><ChevronRight className="h-4 w-4" /></button>}
                        </div>
                      </li>
                    );
                  })}
                  {!items.length && <li className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">Nenhuma tarefa</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.task ? 'Editar tarefa' : 'Nova tarefa'} size="lg">
        {editing && <TaskForm task={editing.task} initialStatus={editing.status} onClose={() => setEditing(null)} onDelete={() => setDeleting(editing.task)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel="Excluir" loading={del.isPending} title="Excluir tarefa"
        message={<>Excluir a tarefa <strong>{deleting?.title}</strong>?</>} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}
