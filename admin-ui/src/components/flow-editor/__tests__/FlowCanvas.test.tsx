import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../../test/utils';
import FlowCanvas from '../FlowCanvas';
import type { FlowStep } from '../../../api/authFlows';

function makeStep(overrides: Partial<FlowStep> = {}): FlowStep {
  return {
    id: 'password-1',
    type: 'password',
    required: true,
    order: 1,
    condition: null,
    fallbackStepId: null,
    config: {},
    ...overrides,
  };
}

const twoSteps: FlowStep[] = [
  makeStep({ id: 'password-1', type: 'password', order: 1 }),
  makeStep({ id: 'totp-1', type: 'totp', order: 2 }),
];

describe('FlowCanvas', () => {
  it('shows empty-state message when steps is empty', () => {
    render(<FlowCanvas steps={[]} onChange={vi.fn()} />);
    expect(
      screen.getByText(/Drag a step from the palette or click a type to add it/i),
    ).toBeInTheDocument();
  });

  it('renders nodes for each step', () => {
    render(<FlowCanvas steps={twoSteps} onChange={vi.fn()} />);
    expect(screen.getByTestId('flow-step-node-password-1')).toBeInTheDocument();
    expect(screen.getByTestId('flow-step-node-totp-1')).toBeInTheDocument();
  });

  it('renders the step palette in edit mode', () => {
    render(<FlowCanvas steps={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId('palette-step-password')).toBeInTheDocument();
    expect(screen.getByTestId('palette-step-totp')).toBeInTheDocument();
  });

  it('hides the step palette in preview mode', () => {
    render(<FlowCanvas steps={[]} onChange={vi.fn()} isPreview />);
    expect(screen.queryByTestId('palette-step-password')).not.toBeInTheDocument();
  });

  it('adds a step when clicking a palette item', () => {
    const onChange = vi.fn();
    render(<FlowCanvas steps={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('palette-step-totp'));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'totp' }),
      ]),
    );
  });

  it('removes a step when delete button is clicked', () => {
    const onChange = vi.fn();
    render(<FlowCanvas steps={twoSteps} onChange={onChange} />);
    const deleteButtons = screen.getAllByLabelText('Delete step');
    fireEvent.click(deleteButtons[0]);
    const newSteps: FlowStep[] = onChange.mock.calls[0][0];
    expect(newSteps.length).toBe(1);
  });

  it('opens the step editor when a node is clicked', () => {
    render(<FlowCanvas steps={twoSteps} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flow-step-node-password-1'));
    expect(screen.getByLabelText('Close step editor')).toBeInTheDocument();
  });

  it('closes the step editor when close button is clicked', () => {
    render(<FlowCanvas steps={twoSteps} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flow-step-node-password-1'));
    fireEvent.click(screen.getByLabelText('Close step editor'));
    expect(screen.queryByLabelText('Close step editor')).not.toBeInTheDocument();
  });

  it('shows a validation warning when all steps are conditional', () => {
    const allConditional: FlowStep[] = [
      makeStep({
        id: 'password-1',
        type: 'password',
        order: 1,
        condition: { field: 'user.group', operator: 'eq', value: 'admin' },
      }),
    ];
    render(<FlowCanvas steps={allConditional} onChange={vi.fn()} />);
    expect(screen.getByText(/entirely skipped/i)).toBeInTheDocument();
  });

  it('shows a warning when no credential step is present', () => {
    const noCredential: FlowStep[] = [
      makeStep({ id: 'consent-1', type: 'consent', order: 1 }),
    ];
    render(<FlowCanvas steps={noCredential} onChange={vi.fn()} />);
    expect(screen.getByText(/no credential step/i)).toBeInTheDocument();
  });

  it('shows warning for invalid fallback reference', () => {
    const badFallback: FlowStep[] = [
      makeStep({ id: 'password-1', type: 'password', order: 1, fallbackStepId: 'nonexistent' }),
    ];
    render(<FlowCanvas steps={badFallback} onChange={vi.fn()} />);
    expect(screen.getByText(/non-existent fallback/i)).toBeInTheDocument();
  });

  it('reorders steps when move-up is clicked', () => {
    const onChange = vi.fn();
    render(<FlowCanvas steps={twoSteps} onChange={onChange} />);
    const moveUpButtons = screen.getAllByLabelText('Move step up');
    // Second node (index 1) should have an enabled move-up
    fireEvent.click(moveUpButtons[1]);
    const newSteps: FlowStep[] = onChange.mock.calls[0][0];
    expect(newSteps[0].id).toBe('totp-1');
    expect(newSteps[1].id).toBe('password-1');
  });

  it('shows preview empty-state in preview mode with no steps', () => {
    render(<FlowCanvas steps={[]} onChange={vi.fn()} isPreview />);
    expect(screen.getByText(/No steps defined/i)).toBeInTheDocument();
  });
});
