import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RoutingStatus from '@/components/MapPage/RoutingStatus';

describe('Map Routing Display Tests', () => {
  it('should display loading state when routing is in progress', () => {
    const { getByText } = render(
      <RoutingStatus
        isLoading={true}
        error={null}
        distance={null}
        transportMode="car"
      />
    );

    expect(getByText('Построение маршрута…')).toBeTruthy();
  });

  it('should display route distance and time when routing succeeds', () => {
    const { getByText } = render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={8500}
        transportMode="car"
      />
    );

    expect(getByText('Маршрут построен')).toBeTruthy();
    expect(getByText('8.5 км')).toBeTruthy();
  });

  it('should display error message when routing fails', () => {
    const errorMessage = 'Network error occurred';
    const { getByText } = render(
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

  it('should display fallback message when using direct line', () => {
    const { getByText } = render(
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

  it('should display correct transport mode label', () => {
    const { getByText: getByTextBike } = render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={5000}
        transportMode="bike"
      />
    );

    expect(getByTextBike('Велосипед')).toBeTruthy();
  });

  it('should display correct time estimate for car', () => {
    const { getByText } = render(
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

  it('should display correct time estimate for bike', () => {
    const { getByText } = render(
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

  it('should display correct time estimate for foot', () => {
    const { getByText } = render(
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

  it('should display distance in meters for short distances', () => {
    const { getByText } = render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={500}
        transportMode="car"
      />
    );

    expect(getByText('500 м')).toBeTruthy();
  });

  it('should display distance in kilometers for long distances', () => {
    const { getByText } = render(
      <RoutingStatus
        isLoading={false}
        error={false}
        distance={15000}
        transportMode="car"
      />
    );

    expect(getByText('15.0 км')).toBeTruthy();
  });

  it('should return null when no route data and not loading', () => {
    const { queryByText } = render(
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
