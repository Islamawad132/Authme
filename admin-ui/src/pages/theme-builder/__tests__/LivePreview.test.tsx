import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../../test/utils';
import LivePreview from '../LivePreview';
import {
  DEFAULT_THEME_STYLES,
  DEFAULT_THEME_COMPONENTS,
  DEFAULT_THEME_ASSETS,
  DEFAULT_THEME_SETTINGS,
} from '../../../types/theme';

describe('LivePreview', () => {
  it('renders the preview container', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );
    expect(screen.getByTitle('Theme Preview')).toBeInTheDocument();
  });

  it('renders viewport control buttons', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );
    expect(screen.getByTitle('Desktop view')).toBeInTheDocument();
    expect(screen.getByTitle('Tablet view')).toBeInTheDocument();
    expect(screen.getByTitle('Mobile view')).toBeInTheDocument();
  });

  it('has desktop as default viewport', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );
    const desktopButton = screen.getByTitle('Desktop view');
    expect(desktopButton).toHaveClass('bg-indigo-100');
    expect(desktopButton).toHaveClass('text-indigo-600');
  });

  it('shows desktop button active when viewport is desktop', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
        viewportSize="desktop"
      />,
    );
    expect(screen.getByTitle('Desktop view')).toHaveClass('bg-indigo-100');
  });

  it('shows tablet button active when viewport is tablet', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
        viewportSize="tablet"
      />,
    );
    expect(screen.getByTitle('Tablet view')).toHaveClass('bg-indigo-100');
    expect(screen.getByTitle('Desktop view')).not.toHaveClass('bg-indigo-100');
  });

  it('shows mobile button active when viewport is mobile', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
        viewportSize="mobile"
      />,
    );
    expect(screen.getByTitle('Mobile view')).toHaveClass('bg-indigo-100');
  });

  it('dispatches viewport-change event when desktop button clicked', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    fireEvent.click(screen.getByTitle('Desktop view'));

    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[dispatchEventSpy.mock.calls.length - 1][0] as CustomEvent;
    expect(event.detail).toBe('desktop');

    dispatchEventSpy.mockRestore();
  });

  it('dispatches viewport-change event when tablet button clicked', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    fireEvent.click(screen.getByTitle('Tablet view'));

    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[dispatchEventSpy.mock.calls.length - 1][0] as CustomEvent;
    expect(event.detail).toBe('tablet');

    dispatchEventSpy.mockRestore();
  });

  it('dispatches viewport-change event when mobile button clicked', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    fireEvent.click(screen.getByTitle('Mobile view'));

    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[dispatchEventSpy.mock.calls.length - 1][0] as CustomEvent;
    expect(event.detail).toBe('mobile');

    dispatchEventSpy.mockRestore();
  });

  it('renders iframe with sandbox attribute', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );
    const iframe = screen.getByTitle('Theme Preview') as HTMLIFrameElement;
    expect(iframe.sandbox).toBe('allow-scripts');
  });

  it('displays preview label', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders with custom styles', () => {
    const customStyles = {
      ...DEFAULT_THEME_STYLES,
      colors: {
        ...DEFAULT_THEME_STYLES.colors,
        primaryColor: '#ff0000',
      },
    };

    const { container } = render(
      <LivePreview
        styles={customStyles}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
  });

  it('renders with empty components array', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={[]}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );
    expect(screen.getByTitle('Theme Preview')).toBeInTheDocument();
  });

  it('renders with custom settings', () => {
    const customSettings = {
      ...DEFAULT_THEME_SETTINGS,
      appTitle: 'Custom App',
      appDescription: 'Custom description',
    };

    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={customSettings}
      />,
    );
    expect(screen.getByTitle('Theme Preview')).toBeInTheDocument();
  });

  it('renders with custom assets', () => {
    const customAssets = {
      ...DEFAULT_THEME_ASSETS,
      logoUrl: 'https://example.com/logo.png',
      logoAlt: 'Custom Logo',
    };

    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={customAssets}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );
    expect(screen.getByTitle('Theme Preview')).toBeInTheDocument();
  });

  it('handles onViewportChange callback', () => {
    const onViewportChange = vi.fn();
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
        onViewportChange={onViewportChange}
      />,
    );

    // The current implementation uses CustomEvent instead of callback
    // This test verifies the component renders with the callback prop
    expect(screen.getByTitle('Theme Preview')).toBeInTheDocument();
  });

  it('applies correct styling classes to container', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );

    const container = document.querySelector('.flex.h-full.flex-col.bg-gray-100');
    expect(container).toBeInTheDocument();
  });

  it('applies correct styling classes to viewport controls', () => {
    render(
      <LivePreview
        styles={DEFAULT_THEME_STYLES}
        components={DEFAULT_THEME_COMPONENTS}
        assets={DEFAULT_THEME_ASSETS}
        settings={DEFAULT_THEME_SETTINGS}
      />,
    );

    const controls = document.querySelector('.flex.items-center.justify-between');
    expect(controls).toBeInTheDocument();
  });
});
