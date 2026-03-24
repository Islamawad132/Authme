import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../../test/utils';
import FlowStepNode from '../FlowStepNode';
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

describe('FlowStepNode', () => {
  it('renders the step type label', () => {
    render(
      <FlowStepNode
        step={makeStep()}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('renders the step order', () => {
    render(
      <FlowStepNode
        step={makeStep({ order: 3 })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Step 3/)).toBeInTheDocument();
  });

  it('renders the Required badge when required=true', () => {
    render(
      <FlowStepNode
        step={makeStep({ required: true })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('does not render the Required badge when required=false', () => {
    render(
      <FlowStepNode
        step={makeStep({ required: false })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });

  it('shows Conditional indicator when condition is set', () => {
    render(
      <FlowStepNode
        step={makeStep({ condition: { field: 'user.group', operator: 'eq', value: 'admin' } })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Conditional/)).toBeInTheDocument();
  });

  it('shows fallback indicator when fallbackStepId is set', () => {
    render(
      <FlowStepNode
        step={makeStep({ fallbackStepId: 'totp-1' })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Has fallback/)).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <FlowStepNode
        step={makeStep()}
        isSelected={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId('flow-step-node-password-1'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'password-1' }));
  });

  it('applies selected ring when isSelected=true', () => {
    render(
      <FlowStepNode
        step={makeStep()}
        isSelected={true}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId('flow-step-node-password-1')).toHaveClass('ring-2');
  });

  it('hides action buttons in preview mode', () => {
    render(
      <FlowStepNode
        step={makeStep()}
        isSelected={false}
        isPreview={true}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/Move step up/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Delete step/)).not.toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(
      <FlowStepNode
        step={makeStep()}
        isSelected={false}
        onSelect={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete step'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('disables move-up button when canMoveUp=false', () => {
    render(
      <FlowStepNode
        step={makeStep()}
        isSelected={false}
        onSelect={vi.fn()}
        canMoveUp={false}
      />,
    );
    expect(screen.getByLabelText('Move step up')).toBeDisabled();
  });

  it('renders TOTP type correctly', () => {
    render(
      <FlowStepNode
        step={makeStep({ type: 'totp', id: 'totp-1' })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('TOTP')).toBeInTheDocument();
  });

  it('renders the step ID as a mono chip', () => {
    render(
      <FlowStepNode
        step={makeStep({ id: 'my-custom-step' })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('my-custom-step')).toBeInTheDocument();
  });
});
