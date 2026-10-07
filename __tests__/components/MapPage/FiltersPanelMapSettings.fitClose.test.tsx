import { render, fireEvent } from '@testing-library/react-native';
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover';
import { getThemedColors } from '@/constants/designSystem';
import { translate } from '@/i18n';
import type { MapUiApi } from '@/types/mapUi';

const renderLayers = (canFit: boolean) => {
  const close = jest.fn(), fit = jest.fn();
  const api: MapUiApi = {
    zoomIn: jest.fn(), zoomOut: jest.fn(), centerOnUser: jest.fn(), fitToResults: fit,
    exportGpx: jest.fn(), exportKml: jest.fn(), setBaseLayer: jest.fn(), setOverlayEnabled: jest.fn(),
    capabilities: { canCenterOnUser: true, canFitToResults: canFit, canExportRoute: false },
  };
  const view = render(<MapMobileLayersPopover colors={getThemedColors(false)} top={72} mapUiApi={api} enabledOverlays={{}} onOverlayToggle={jest.fn()} showBaseLayer={false} onRequestClose={close} />);
  return { ...view, close, fit };
};

describe('layers action ownership', () => {
  const label = translate('map:components.MapPage.FiltersPanelMapSettings.pokazat_vse_rezultaty_na_karte_03fcd330');
  it('the actual show-all action fits first and closes its owning popover', () => {
    const view = renderLayers(true);
    fireEvent.press(view.getByLabelText(label));
    expect(view.fit).toHaveBeenCalledTimes(1);
    expect(view.close).toHaveBeenCalledTimes(1);
    expect(view.fit.mock.invocationCallOrder[0]).toBeLessThan(view.close.mock.invocationCallOrder[0]);
  });
  it('a disabled fit action neither moves the map nor closes the popover', () => {
    const view = renderLayers(false);
    fireEvent.press(view.getByLabelText(label));
    expect(view.fit).not.toHaveBeenCalled();
    expect(view.close).not.toHaveBeenCalled();
  });
});
