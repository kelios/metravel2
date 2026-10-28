import { render } from '@testing-library/react-native';
import RoutingStatus from '@/components/MapPage/RoutingStatus';

describe('Map Routing Display Tests', () => {
  it('should display loading state when routing is in progress', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={true}
        error={null}
        distance={null}
        transportMode="car"
      />
    );

    expect(getByText('Построение маршрута…')).toBeTruthy();
  });

  it('should display route distance and time when routing succeeds', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={8500}
        transportMode="car"
      />
    );

    expect(getByText('Маршрут построен')).toBeTruthy();
    // #1440: разделитель дробной части берётся из локали интерфейса (RU — запятая)
    expect(getByText('8,5 км')).toBeTruthy();
  });

  it('should display error message when routing fails', async () => {
    const errorMessage = 'Network error occurred';
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={errorMessage}
        distance={null}
        transportMode="car"
      />
    );

    expect(getByText('Ошибка маршрутизации')).toBeTruthy();
    expect(getByText(errorMessage)).toBeTruthy();
  });

  it('should display fallback message when using direct line', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error="Using direct line"
        distance={5000}
        transportMode="car"
      />
    );

    expect(getByText('Прямая линия')).toBeTruthy();
    expect(getByText('Оптимальный маршрут недоступен, показана прямая линия')).toBeTruthy();
  });

  it('should display correct transport mode icon in header', async () => {
    const { getByText, getByTestId } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={5000}
        transportMode="bike"
      />
    );

    // Transport mode is shown via icon in header, not as separate card
    expect(getByText('Маршрут построен')).toBeTruthy();
    expect(getByTestId('mci-bike')).toBeTruthy(); // bike icon
  });

  it('should display correct time estimate for car', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={60000}
        transportMode="car"
      />
    );

    // 60km at 60km/h = 1 hour
    expect(getByText('1 ч')).toBeTruthy();
  });

  it('should display correct time estimate for bike', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={20000}
        transportMode="bike"
      />
    );

    // 20km at 20km/h = 1 hour
    expect(getByText('1 ч')).toBeTruthy();
  });

  it('should display correct time estimate for foot', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={5000}
        transportMode="foot"
      />
    );

    // 5km at 5km/h = 1 hour
    expect(getByText('1 ч')).toBeTruthy();
  });

  it('should display distance in meters for short distances', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={500}
        transportMode="car"
      />
    );

    expect(getByText('500 м')).toBeTruthy();
  });

  it('should display distance in kilometers for long distances', async () => {
    const { getByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={15000}
        transportMode="car"
      />
    );

    expect(getByText('15,0 км')).toBeTruthy();
  });

  it('should return null when no route data and not loading', async () => {
    const { queryByText } = await render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={null}
        transportMode="car"
      />
    );

    // Should render nothing (null) - no text should be present
    expect(queryByText('Маршрут построен')).toBeNull();
  });
});
