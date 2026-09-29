import { branchLabel } from '../domain/branches';
import type { Branch } from '../types';

export default function BranchSelect({
  branches,
  value,
  onChange,
  id = 'branch-id',
}: {
  branches: Branch[];
  value: string;
  onChange: (branchId: string) => void;
  id?: string;
}) {
  if (branches.length === 0) return null;
  return (
    <div className="form-field full">
      <label htmlFor={id}>Sucursal *</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{branchLabel(b)}</option>
        ))}
      </select>
      <span className="form-hint">El artículo quedará asignado a esta sucursal.</span>
    </div>
  );
}
