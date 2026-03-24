import type { FlowStepCondition, ConditionOperator } from '../../api/authFlows';

interface FlowConditionEditorProps {
  condition: FlowStepCondition | null | undefined;
  onChange: (condition: FlowStepCondition | null) => void;
}

const OPERATORS: { value: ConditionOperator; label: string; hasValue: boolean }[] = [
  { value: 'eq', label: 'equals', hasValue: true },
  { value: 'neq', label: 'not equals', hasValue: true },
  { value: 'in', label: 'in (comma-separated)', hasValue: true },
  { value: 'not_in', label: 'not in (comma-separated)', hasValue: true },
  { value: 'exists', label: 'exists', hasValue: false },
  { value: 'not_exists', label: 'does not exist', hasValue: false },
];

const FIELD_SUGGESTIONS = [
  'user.group',
  'user.role',
  'user.attribute',
  'client.id',
  'network.ip',
  'session.amr',
];

export default function FlowConditionEditor({
  condition,
  onChange,
}: FlowConditionEditorProps) {
  const enabled = condition != null;
  const op = OPERATORS.find((o) => o.value === condition?.operator) ?? OPERATORS[0];

  function handleToggle() {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ field: '', operator: 'eq', value: '' });
    }
  }

  function handleField(field: string) {
    if (!condition) return;
    onChange({ ...condition, field });
  }

  function handleOperator(operator: ConditionOperator) {
    if (!condition) return;
    const newOp = OPERATORS.find((o) => o.value === operator)!;
    onChange({ ...condition, operator, value: newOp.hasValue ? condition.value ?? '' : undefined });
  }

  function handleValue(raw: string) {
    if (!condition) return;
    const value = condition.operator === 'in' || condition.operator === 'not_in'
      ? raw.split(',').map((v) => v.trim()).filter(Boolean)
      : raw;
    onChange({ ...condition, value });
  }

  const valueDisplay = (() => {
    if (!condition?.value) return '';
    if (Array.isArray(condition.value)) return condition.value.join(', ');
    return String(condition.value);
  })();

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm font-medium text-gray-700">Enable condition</span>
      </label>

      {enabled && condition && (
        <div className="ml-6 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">
            This step is skipped when the condition does NOT match.
          </p>

          {/* Field */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Context field
            </label>
            <input
              list="field-suggestions"
              value={condition.field}
              onChange={(e) => handleField(e.target.value)}
              placeholder="e.g. user.group"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <datalist id="field-suggestions">
              {FIELD_SUGGESTIONS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>

          {/* Operator */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Operator
            </label>
            <select
              value={condition.operator}
              onChange={(e) => handleOperator(e.target.value as ConditionOperator)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Value (only when operator needs one) */}
          {op.hasValue && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Value
                {(condition.operator === 'in' || condition.operator === 'not_in') && (
                  <span className="ml-1 text-gray-400">(comma-separated)</span>
                )}
              </label>
              <input
                value={valueDisplay}
                onChange={(e) => handleValue(e.target.value)}
                placeholder="Enter value..."
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
